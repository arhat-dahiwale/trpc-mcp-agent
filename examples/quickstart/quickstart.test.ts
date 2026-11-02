/**
 * Proves the README quickstart actually works: the exact options from
 * mcp-server.ts, driven by a real MCP client over an in-memory transport.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createMcpServer } from "@trpc-mcp/mcp";
import { serverOptions } from "./mcp-server.js";

describe("README quickstart", () => {
  it("lists searchNotes and calls it through the tRPC caller", async () => {
    const mcpServer = createMcpServer(serverOptions, {
      transport: "stdio",
      env: {},
    });
    const client = new Client({ name: "quickstart-test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([mcpServer.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(["searchNotes"]);

    const result = await client.callTool({
      name: "searchNotes",
      arguments: { query: "pricing" },
    });
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: "text", text: '[{"id":"1","title":"Result for pricing"}]' },
    ]);

    await mcpServer.close();
    await client.close();
  });
});
