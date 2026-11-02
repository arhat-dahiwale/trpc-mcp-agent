/**
 * @trpc-mcp/mcp
 *
 * Expose a tRPC router as an MCP server (stdio transport, plus a Streamable
 * HTTP handler in Phase 4). Every tool call runs through the tRPC caller, so
 * middleware, auth, and validation behave exactly as for human clients.
 */

export { createMcpServer } from "./server.js";
export { serveStdio } from "./stdio.js";
export type { McpServerOptions, TrpcMcpServer } from "./types.js";
