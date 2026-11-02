/**
 * HTTP transport tests: the fetch-style handler is exercised directly with
 * Web Standard Requests, plus one end-to-end test driving the real MCP SDK
 * HTTP client against a node:http server that adapts to the fetch handler.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createServer, type Server as NodeServer } from "node:http";
import { describe, expect, it, afterAll } from "vitest";
import { createHttpHandler } from "./http.js";
import { testContexts, testRouter, type TestContext, type TestRouter } from "@trpc-mcp/test-utils";

function makeHandler(context: () => TestContext) {
  return createHttpHandler<TestRouter, TestContext>({
    router: testRouter,
    name: "http-test",
    version: "0.0.1",
    createContext: async (info) => {
      // "Auth": require a bearer token; context shows what the policy sees.
      if (info.transport !== "http") return context();
      const auth = info.request.headers.get("authorization");
      if (auth === "Bearer good-token") return context();
      return testContexts.anonymous();
    },
    suppressAuthWarning: true,
  });
}

function post(
  handler: ReturnType<typeof makeHandler>,
  body: unknown,
  headers?: Record<string, string>,
) {
  return handler(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  // JSON responses only (stateless + accept json); SSE lines would need parsing.
  if (text.startsWith("event:") || text.startsWith("data:")) {
    const dataLine = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .pop();
    return JSON.parse(dataLine ?? "{}") as Record<string, unknown>;
  }
  return JSON.parse(text) as Record<string, unknown>;
}

describe("createHttpHandler (direct fetch-style)", () => {
  it("answers initialize with JSON-RPC result", async () => {
    const handler = makeHandler(() => testContexts.member());
    const response = await post(handler, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    });
    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect((body.result as Record<string, unknown>).serverInfo).toMatchObject({
      name: "http-test",
      version: "0.0.1",
    });
  });

  it("serves tools/call with a bearer token and runs middleware", async () => {
    const handler = makeHandler(() => testContexts.member());
    const response = await post(
      handler,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "notes_search", arguments: { query: "x" } },
      },
      { authorization: "Bearer good-token" },
    );
    const body = await readJson(response);
    const result = body.result as { content: Array<{ text: string }>; isError?: boolean };
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? "[]")).toEqual([
      { id: "n1", title: "Result for x", body: "searched", limit: 5 },
    ]);
  });

  it("hides tools without auth: call succeeds only through middleware denial, hidden uncallable", async () => {
    const handler = makeHandler(() => testContexts.member());
    // No auth header -> anonymous context: authed tools deny via middleware.
    const denied = await readJson(
      await post(handler, {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "notes_create", arguments: { title: "t" } },
      }),
    );
    const deniedResult = denied.result as { isError?: boolean; content: Array<{ text: string }> };
    expect(deniedResult.isError).toBe(true);
    expect(JSON.parse(deniedResult.content[0]?.text ?? "{}").code).toBe("UNAUTHORIZED");

    // Hidden tool is not callable regardless of auth.
    const hidden = await readJson(
      await post(
        handler,
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "admin_hidden", arguments: { secret: "s" } },
        },
        { authorization: "Bearer good-token" },
      ),
    );
    const hiddenResult = hidden.result as { isError?: boolean; content: Array<{ text: string }> };
    expect(hiddenResult.isError).toBe(true);
    expect(JSON.parse(hiddenResult.content[0]?.text ?? "{}").code).toBe("NOT_FOUND");
  });

  it("never leaks stacks or internals in error responses", async () => {
    const handler = makeHandler(() => testContexts.member());
    const response = await post(
      handler,
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "leak" } },
      { authorization: "Bearer good-token" },
    );
    const text = JSON.stringify(await readJson(response));
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("stack");
  });

  it("malformed JSON-RPC yields an error response without internals", async () => {
    const handler = makeHandler(() => testContexts.member());
    const response = await handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: "not-json",
      }),
    );
    const body = await readJson(response);
    expect((body.error as { code: number }).code).toBeLessThan(0);
    expect(JSON.stringify(body)).not.toContain("at ");
  });

  it("warns when the context factory ignores auth", () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (msg: string) => warnings.push(msg);
    try {
      createHttpHandler<TestRouter, TestContext>({
        router: testRouter,
        name: "warn-test",
        version: "0",
        createContext: () => testContexts.member(),
      });
    } finally {
      console.warn = original;
    }
    expect(warnings.some((w) => w.includes("does not appear to read any authentication"))).toBe(
      true,
    );
  });
});

describe("createHttpHandler end-to-end with the SDK HTTP client", () => {
  let server: NodeServer | undefined;
  let baseUrl = "";

  async function startServer(context: () => TestContext): Promise<string> {
    const handler = makeHandler(context);
    const nodeServer = createServer((req, res) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        const request = new Request(url, {
          method: req.method,
          headers: new Headers(req.headers as Record<string, string>),
          body: ["GET", "HEAD"].includes(req.method ?? "") ? undefined : Buffer.concat(chunks),
          duplex: "half",
        });
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body !== null) {
          const reader = response.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        res.end();
      })().catch(() => {
        res.writeHead(500);
        res.end();
      });
    });
    await new Promise<void>((resolve) => nodeServer.listen(0, "127.0.0.1", resolve));
    server = nodeServer;
    const address = nodeServer.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    return `http://127.0.0.1:${port}/mcp`;
  }

  afterAll(async () => {
    if (server !== undefined) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
  });

  it("initialize, list, call through the real StreamableHTTP client", async () => {
    baseUrl = await startServer(() => testContexts.member());
    const client = new Client({ name: "http-e2e", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
      requestInit: { headers: { authorization: "Bearer good-token" } },
    });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("notes_search");
      const result = await client.callTool({
        name: "notes_search",
        arguments: { query: "http" },
      });
      expect(result.isError).toBeUndefined();
      expect(
        JSON.parse((result.content as Array<{ type: string; text: string }>)[0]?.text ?? "[]"),
      ).toEqual([{ id: "n1", title: "Result for http", body: "searched", limit: 5 }]);
    } finally {
      await client.close();
    }
  });
});
