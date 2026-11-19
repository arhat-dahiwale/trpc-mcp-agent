/**
 * End-to-end stdio check: spawn examples/stdio-demo as a child process and
 * talk to it with the SDK stdio client. Proves serveStdio works with a real
 * transport, not just in-memory pairs.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

const demoDir = resolve(import.meta.dirname, "../../../examples/stdio-demo");

describe("stdio demo (child process)", () => {
  it("lists and calls tools over real stdio", { timeout: 60_000 }, async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "server.ts"],
      cwd: demoDir,
      env: { ...process.env, MCP_USER_ID: "u-demo" },
    });
    const client = new Client({ name: "stdio-e2e", version: "0.0.0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual(["createTask", "greeting", "health"]);

      const greeting = await client.callTool({
        name: "greeting",
        arguments: { name: "Inspector" },
      });
      expect(greeting.content).toEqual([{ type: "text", text: '{"hello":"Inspector"}' }]);

      // Middleware runs through the caller: without MCP_USER_ID the mutation
      // fails with UNAUTHORIZED; with it, it succeeds.
      const created = await client.callTool({
        name: "createTask",
        arguments: { title: "write tests" },
      });
      expect(created.isError).toBeUndefined();
      expect(
        JSON.parse((created.content as Array<{ type: string; text: string }>)[0]?.text ?? "{}"),
      ).toMatchObject({
        createdBy: "u-demo",
        title: "write tests",
      });
    } finally {
      await client.close();
    }
  });

  it("denies mutations when MCP_USER_ID is set to an empty string", { timeout: 60_000 }, async () => {
    // Clients routinely pass empty env vars; an empty user id must not count
    // as authentication. Regression: the demo middleware only rejected null.
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "server.ts"],
      cwd: demoDir,
      env: { ...process.env, MCP_USER_ID: "" },
    });
    const client = new Client({ name: "stdio-e2e-empty", version: "0.0.0" });
    await client.connect(transport);
    try {
      const denied = await client.callTool({
        name: "createTask",
        arguments: { title: "should fail" },
      });
      expect(denied.isError).toBe(true);
      const payload = JSON.parse(
        (denied.content as Array<{ type: string; text: string }>)[0]?.text ?? "{}",
      ) as { code?: string };
      expect(payload.code).toBe("UNAUTHORIZED");
    } finally {
      await client.close();
    }
  });
});
