import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AnyRouter } from "@trpc/server";
import type { McpServerOptions } from "./types.js";
import { createMcpServer } from "./server.js";

export interface HttpHandlerOptions<TRouter extends AnyRouter, Ctx> extends McpServerOptions<
  TRouter,
  Ctx
> {
  /**
   * The handler warns on creation when the context factory looks like it
   * ignores authentication (a source-code heuristic, not a guarantee).
   * Set to true to silence that warning.
   */
  suppressAuthWarning?: boolean;
}

function looksLikeItReadsAuth(fn: (...args: never[]) => unknown): boolean {
  try {
    const source = fn.toString();
    return /authorization|bearer|cookie|session|token|auth|api[-_]?key|x-api/i.test(source);
  } catch {
    return true; // opaque function: assume the author knows what they are doing
  }
}

/**
 * Create a fetch-style MCP endpoint over the Streamable HTTP transport.
 *
 * Runs on Node 20+, Bun, Deno, Cloudflare Workers, Hono, Next.js Route
 * Handlers - anything that speaks Web Standard `Request`/`Response`.
 *
 * Stateless mode: every request gets a fresh server + transport and builds
 * its context from that request (`createContext({ transport: "http",
 * request })`). No session state is kept; clients may send `initialize` on
 * every request or rely on stateless-aware clients.
 *
 * Security notes:
 * - Authentication is entirely in YOUR `createContext` (read the
 *   `Authorization` header from `info.request`). The handler warns on
 *   creation when the factory looks like it ignores auth.
 * - Errors never include stacks or internals (sanitized by the registry).
 */
export function createHttpHandler<TRouter extends AnyRouter, Ctx>(
  options: HttpHandlerOptions<TRouter, Ctx>,
): (req: Request) => Promise<Response> {
  if (
    options.suppressAuthWarning !== true &&
    looksLikeItReadsAuth(options.createContext as unknown as (...args: never[]) => unknown) ===
      false
  ) {
    // Diagnostics only; stderr-bound via console.warn. Never part of responses.
    console.warn(
      "[trpc-mcp] createHttpHandler: the provided createContext does not appear to read any authentication material (headers/tokens/cookies). MCP over HTTP without authentication exposes the exposed tools to anyone who can reach the endpoint.",
    );
  }

  return async (request: Request): Promise<Response> => {
    // Stateless mode has no session for a GET SSE stream to attach to, and
    // DELETE has no session to terminate. The SDK transport would instead
    // open a never-completing SSE stream (GET) or return a misleading 200
    // (DELETE), so answer 405 here - explicitly allowed by the MCP spec for
    // servers that do not provide server-initiated streams.
    const method = request.method.toUpperCase();
    if (method === "GET" || method === "DELETE") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method Not Allowed: stateless HTTP server" },
          id: null,
        }),
        {
          status: 405,
          headers: {
            "content-type": "application/json",
            allow: "POST",
          },
        },
      );
    }
    // Stateless: a fresh transport + server per request, context per request.
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = createMcpServer(options, { transport: "http", request });
    await mcpServer.server.connect(transport);
    try {
      return await transport.handleRequest(request);
    } catch {
      // Transport-level failure (bad JSON-RPC etc.). Never leak internals.
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  };
}
