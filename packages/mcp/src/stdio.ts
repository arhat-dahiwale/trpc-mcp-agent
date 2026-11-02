import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { TransportInfo } from "@trpc-mcp/core";
import type { AnyRouter } from "@trpc/server";
import type { McpServerOptions, TrpcMcpServer } from "./types.js";
import { createMcpServer } from "./server.js";

/**
 * Serve the router as an MCP server over stdio.
 *
 * Resolves once the server is connected; the process stays alive until the
 * client disconnects or the process receives SIGINT/SIGTERM. Nothing is ever
 * written to stdout (the protocol channel); diagnostics belong on stderr.
 */
export async function serveStdio<TRouter extends AnyRouter, Ctx>(
  options: McpServerOptions<TRouter, Ctx>,
): Promise<void> {
  const info: TransportInfo = { transport: "stdio", env: process.env };
  const mcpServer: TrpcMcpServer<TRouter, Ctx> = createMcpServer(options, info);
  await mcpServer.connect(new StdioServerTransport());

  const shutdown = (): void => {
    void mcpServer.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
