import { describe, expect, it } from "vitest";
import { app } from "./server.js";

/** Hono supports Web Standard Requests directly via app.request. */
describe("hono example", () => {
  it("answers tools/list and tools/call with the demo bearer token", async () => {
    const init = await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer demo-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "greet", arguments: { name: "Hono" } },
      }),
    });
    expect(init.status).toBe(200);
    const text = await init.text();
    const dataLine = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .pop();
    const body = JSON.parse(dataLine ?? text) as {
      result?: { content?: Array<{ text?: string }> };
    };
    expect(body.result?.content?.[0]?.text).toBe(JSON.stringify("Hello, Hono!"));
  });

  it("denies authed mutations for anonymous callers", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "addTask", arguments: { title: "x" } },
      }),
    });
    const text = await response.text();
    const dataLine = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .pop();
    const body = JSON.parse(dataLine ?? text) as {
      result?: { isError?: boolean; content?: Array<{ text?: string }> };
    };
    expect(body.result?.isError).toBe(true);
    expect(JSON.parse(body.result?.content?.[0]?.text ?? "{}").code).toBe("UNAUTHORIZED");
  });
});
