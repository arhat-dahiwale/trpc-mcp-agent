import type { AnyRouter } from "@trpc/server";
import type { RegistryOptions, ToolRegistry, TransportInfo } from "@trpc-mcp/core";

/**
 * Options for the MCP adapter: the registry options plus server identity.
 */
export interface McpServerOptions<TRouter extends AnyRouter, Ctx> extends RegistryOptions<
  TRouter,
  Ctx
> {
  /** Server name reported during `initialize`. */
  name: string;
  /** Server version reported during `initialize`. */
  version: string;
  /** Optional instructions shown to MCP clients. */
  instructions?: string;
}

/**
 * The object returned by createMcpServer.
 * `connect` accepts any MCP SDK transport (stdio, in-memory, Streamable HTTP).
 */
export interface TrpcMcpServer<TRouter extends AnyRouter = AnyRouter, Ctx = unknown> {
  /** The underlying low-level MCP SDK server instance. */
  readonly server: import("@modelcontextprotocol/sdk/server/index.js").Server;
  /** The tool registry backing this MCP server. */
  readonly registry: ToolRegistry<TRouter, Ctx>;
  /** Transport info used to build contexts for this connection. */
  readonly transportInfo: TransportInfo;
  /** Connect to a transport and keep serving. */
  connect(
    transport: import("@modelcontextprotocol/sdk/shared/transport.js").Transport,
  ): Promise<void>;
  /** Close the server. */
  close(): Promise<void>;
}
