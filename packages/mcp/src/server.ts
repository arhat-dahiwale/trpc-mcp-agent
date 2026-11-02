import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  createToolRegistry,
  type ToolCallResult,
  type ToolDefinition,
  type TransportInfo,
} from "@trpc-mcp/core";
import type { AnyRouter } from "@trpc/server";
import type { McpServerOptions, TrpcMcpServer } from "./types.js";

/**
 * Map a registry definition to an MCP tool descriptor.
 * Annotations carry the hints derived from the procedure type and meta.
 */
function toMcpTool(def: ToolDefinition): {
  name: string;
  title?: string;
  description: string;
  inputSchema: ToolDefinition["inputSchema"];
  outputSchema?: ToolDefinition["outputSchema"];
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint?: boolean;
  };
} {
  return {
    name: def.name,
    ...(def.title !== undefined ? { title: def.title } : {}),
    description: def.description,
    inputSchema: def.inputSchema,
    ...(def.outputSchema !== undefined ? { outputSchema: def.outputSchema } : {}),
    annotations: {
      readOnlyHint: def.annotations.readOnlyHint === true,
      destructiveHint: def.annotations.destructiveHint === true,
      idempotentHint: def.annotations.idempotentHint === true,
      ...(def.annotations.openWorldHint !== undefined
        ? { openWorldHint: def.annotations.openWorldHint }
        : {}),
    },
  };
}

/**
 * Convert a sanitized registry result into an MCP CallToolResult.
 * Success: JSON text content (plus structuredContent only when the tool
 * declares an output schema, per the MCP spec). Failure: isError true with a
 * sanitized message.
 */
function toCallToolResult(
  result: ToolCallResult,
  hasOutputSchema: boolean,
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
} {
  if (result.ok) {
    const text = JSON.stringify(result.data ?? null);
    const data =
      hasOutputSchema &&
      result.data !== null &&
      typeof result.data === "object" &&
      !Array.isArray(result.data)
        ? (result.data as Record<string, unknown>)
        : undefined;
    return {
      content: [{ type: "text", text }],
      ...(data !== undefined ? { structuredContent: data } : {}),
    };
  }
  const code = result.error?.code ?? "INTERNAL";
  const message = result.error?.message ?? "Internal error.";
  return {
    content: [{ type: "text", text: JSON.stringify({ code, message }) }],
    isError: true,
  };
}

/**
 * Create an MCP server whose tools/list and tools/call are backed by a
 * @trpc-mcp/core registry.
 *
 * The context is built once per connection via `options.createContext`
 * (build a fresh server per HTTP request for per-request contexts).
 *
 * Verified against @modelcontextprotocol/sdk 1.32.2:
 * - the low-level `Server` handles `initialize` and links
 *   `notifications/cancelled` to the handler's `extra.signal`;
 * - progress notifications flow when the client supplies a progress token.
 */
export function createMcpServer<TRouter extends AnyRouter, Ctx>(
  options: McpServerOptions<TRouter, Ctx>,
  transportInfo: TransportInfo,
): TrpcMcpServer<TRouter, Ctx> {
  const registry = createToolRegistry<TRouter, Ctx>(options);

  const server = new Server(
    { name: options.name, version: options.version },
    {
      capabilities: { tools: { listChanged: false } },
      ...(options.instructions !== undefined ? { instructions: options.instructions } : {}),
    },
  );

  // One context per connection, built lazily on first use.
  let ctx: Ctx | undefined;
  let ctxPromise: Promise<Ctx> | undefined;
  async function getContext(): Promise<Ctx> {
    if (ctx !== undefined) return ctx;
    if (ctxPromise === undefined) {
      ctxPromise = (async () => {
        const built = await options.createContext(transportInfo);
        ctx = built;
        return built;
      })();
    }
    return ctxPromise;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const currentCtx = await getContext();
    const tools = await registry.list(currentCtx);
    return { tools: tools.map(toMcpTool) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const currentCtx = await getContext();
    const name = request.params.name;
    const input = request.params.arguments ?? {};
    const progressToken = request.params._meta?.progressToken;
    // Only relevant when the call succeeds (denied calls never reach the
    // structured branch), so looking at the full definition set is safe.
    const hasOutputSchema = registry
      .definitions()
      .some((d) => d.name === name && d.outputSchema !== undefined);

    const result = await registry.call(name, input, currentCtx, {
      // Client cancellation surfaces here: the SDK aborts extra.signal.
      signal: extra.signal,
      transport: transportInfo.transport,
      ...(progressToken !== undefined
        ? {
            onProgress: (event: { progress: number; total?: number; message?: string }) => {
              void extra
                .sendNotification({
                  method: "notifications/progress",
                  params: {
                    progressToken,
                    progress: event.progress,
                    ...(event.total !== undefined ? { total: event.total } : {}),
                    ...(event.message !== undefined ? { message: event.message } : {}),
                  },
                } as never)
                .catch(() => undefined); // a failed progress notification must not break the call
            },
          }
        : {}),
    });

    if (result.error?.code === "CANCELLED") {
      // The client already aborted; per the MCP spec it will not process a
      // response for the cancelled request. Surface it as a tool error so
      // the late response is still well-formed.
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              code: "CANCELLED",
              message: "Tool call was cancelled.",
            }),
          },
        ],
        isError: true,
      };
    }
    return toCallToolResult(result, hasOutputSchema);
  });

  return {
    server,
    registry,
    transportInfo,
    async connect(transport) {
      await server.connect(transport);
    },
    async close() {
      await server.close();
    },
  };
}
