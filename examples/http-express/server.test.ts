/**
 * Minimal test for the Express example: boot the app on an ephemeral port
 * and drive it with fetch. The point is to prove the req/res adapter works;
 * deeper protocol coverage lives in packages/mcp tests.
 */
import { describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "./server.js";

describe("express example", () => {
  it("serves tools/call through the fetch adapter", async () => {
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const address = server.address() as AddressInfo;
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(`${base}/mcp`, {
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
          params: { name: "greet", arguments: { name: "Express" } },
        }),
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      const dataLine = text
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .pop();
      const body = JSON.parse(dataLine ?? text) as {
        result?: { content?: Array<{ text?: string }> };
      };
      expect(body.result?.content?.[0]?.text).toBe(JSON.stringify("Hello, Express!"));
    } finally {
      (server as Server).close();
    }
  });
});
