/**
 * Contract tests: a real MCP SDK client over an in-memory transport talks to
 * createMcpServer. These pin the protocol behaviors AGENTS.md requires.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createMcpServer } from "./server.js";
import {
  resetTestNotes,
  testContexts,
  testRouter,
  type TestContext,
  type TestRouter,
} from "@trpc-mcp/test-utils";
import type { TrpcMcpServer } from "./types.js";

function setup(
  context: () => TestContext,
  policy?: Parameters<typeof createMcpServer<TestRouter, TestContext>>[0]["policy"],
) {
  const mcpServer = createMcpServer<TestRouter, TestContext>(
    {
      router: testRouter,
      name: "test-server",
      version: "0.0.1",
      instructions: "test instructions",
      createContext: () => context(),
      ...(policy !== undefined ? { policy } : {}),
    },
    { transport: "stdio", env: {} },
  );
  const client = new Client({ name: "contract-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const connected = (async () => {
    await Promise.all([
      mcpServer.connect(serverTransport as Transport),
      client.connect(clientTransport),
    ]);
  })();
  return { mcpServer: mcpServer as TrpcMcpServer<TestRouter, TestContext>, client, connected };
}

beforeEach(() => resetTestNotes());

describe("initialize", () => {
  it("connects and reports server info with tools capability", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    // Note: the SDK client's getServerVersion() exposes name/version only;
    // `instructions` is sent in the InitializeResult (verified in SDK types).
    expect(client.getServerVersion()).toMatchObject({
      name: "test-server",
      version: "0.0.1",
    });
  });
});

describe("tools/list", () => {
  it("lists exposed tools with annotations, hiding non-exposed procedures", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toContain("notes_search");
    expect(names).toContain("notes_create");
    expect(names).not.toContain("admin_hidden");

    const search = tools.find((t) => t.name === "notes_search");
    expect(search?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
    expect(search?.inputSchema.type).toBe("object");
    expect(search?.description).toBe("Search notes by keyword");

    const destroy = tools.find((t) => t.name === "notes_destroy");
    expect(destroy?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
  });

  it("applies policy to the listing", async () => {
    const { client, connected } = setup(
      () => testContexts.viewer(),
      (_ctx, tool) => {
        return !tool.tags.includes("dangerous");
      },
    );
    await connected;
    const { tools } = await client.listTools();
    expect(tools.some((t) => t.name === "notes_destroy")).toBe(false);
  });
});

describe("tools/call", () => {
  it("returns JSON text content on success", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const result = await client.callTool({
      name: "notes_search",
      arguments: { query: "pricing" },
    });
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      {
        type: "text",
        text: '[{"id":"n1","title":"Result for pricing","body":"searched","limit":5}]',
      },
    ]);
  });

  it("runs middleware: anonymous context gets an isError result, no internals", async () => {
    const { client, connected } = setup(() => testContexts.anonymous());
    await connected;
    const result = await client.callTool({
      name: "notes_create",
      arguments: { title: "hello" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
    const parsed: { code: string; message: string } = JSON.parse(text);
    expect(parsed.code).toBe("UNAUTHORIZED");
    expect(parsed.message).toBe("Sign in first.");
  });

  it("returns isError for validation failures with sanitized message", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const result = await client.callTool({
      name: "notes_search",
      arguments: { query: 42 },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "";
    const parsed: { code: string; message: string } = JSON.parse(text);
    expect(parsed.code).toBe("BAD_REQUEST");
    expect(text).not.toContain("stack");
  });

  it("internal errors do not leak stacks or secrets", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const result = await client.callTool({ name: "leak" });
    expect(result.isError).toBe(true);
    const text = JSON.stringify(result);
    expect(text).not.toContain("postgres");
    expect(text).not.toContain("hunter2");
    const parsed: { code: string } = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0]?.text ?? "{}",
    );
    expect(parsed.code).toBe("INTERNAL");
  });

  it("unknown tools return an isError result, identical to denied tools", async () => {
    const unknown = setup(() => testContexts.member());
    await unknown.connected;
    const unknownResult = await unknown.client.callTool({ name: "no_such_tool" });

    const denied = setup(
      () => testContexts.member(),
      (_ctx, tool) => tool.name !== "notes_search",
    );
    await denied.connected;
    const deniedResult = await denied.client.callTool({
      name: "notes_search",
      arguments: { query: "x" },
    });

    const unknownText = (unknownResult.content as Array<{ type: string; text: string }>)[0]?.text;
    const deniedText = (deniedResult.content as Array<{ type: string; text: string }>)[0]?.text;
    expect(deniedText).toBe(unknownText);
    expect(JSON.parse(unknownText ?? "{}").code).toBe("NOT_FOUND");
  });

  it("hidden tools are not callable even when the name is guessed", async () => {
    const { client, connected } = setup(() => testContexts.owner());
    await connected;
    const result = await client.callTool({
      name: "admin_hidden",
      arguments: { secret: "x" },
    });
    expect(result.isError).toBe(true);
    expect(
      JSON.parse((result.content as Array<{ type: string; text: string }>)[0]?.text ?? "{}").code,
    ).toBe("NOT_FOUND");
  });

  it("excludes no-input arguments gracefully", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const result = await client.callTool({ name: "health_ping" });
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: '"pong"' }]);
  });

  it("includes structuredContent for tools with an output schema", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const result = await client.callTool({
      name: "user_get",
      arguments: { id: "u1" },
    });
    expect(result.structuredContent).toEqual({ id: "u1", name: "Ada Lovelace" });
  });
});

describe("progress + cancellation", () => {
  it("sends progress notifications when the client supplies a progress token", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const events: Array<{ progress: number; total?: number; message?: string }> = [];
    const result = await client.callTool(
      { name: "jobs_slow", arguments: { steps: 2 } },
      undefined,
      { onprogress: (p) => events.push(p) },
    );
    expect(result.isError).toBeUndefined();
    expect(events.length).toBe(2);
    expect(events[0]).toMatchObject({ progress: 1, total: 2, message: "step 1" });
    expect(events[1]).toMatchObject({ progress: 2, total: 2 });
  });

  it("aborts the procedure when the client cancels", async () => {
    const { client, connected } = setup(() => testContexts.member());
    await connected;
    const controller = new AbortController();
    const call = client.callTool({ name: "jobs_hanging", arguments: {} }, undefined, {
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    await expect(call).rejects.toThrow();
  });
});
