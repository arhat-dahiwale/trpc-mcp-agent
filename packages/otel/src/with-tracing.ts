import { trace, SpanStatusCode, type Tracer } from "@opentelemetry/api";
import type { CallOptions, ToolCallResult, ToolRegistry } from "@trpc-mcp/core";

export interface TracingOptions {
  /** Tracer instrumentation scope name. Defaults to "@trpc-mcp/otel". */
  tracerName?: string;
  /**
   * Record tool input/output as span attributes. OFF by default: tool I/O
   * can carry sensitive data, so it must be opted into explicitly.
   */
  recordIo?: boolean;
  /** Cap for recorded input/output attribute length. Defaults to 4096. */
  ioAttributeLimit?: number;
}

const SPAN_NAME = "trpc-mcp.tool.call";
const DEFAULT_IO_LIMIT = 4096;

function truncated(value: unknown, limit: number): string {
  const text = JSON.stringify(value ?? null);
  return text.length > limit ? `${text.slice(0, limit)}…(truncated)` : text;
}

/**
 * Wrap a tool registry with OpenTelemetry spans.
 *
 * One span per `call`: `trpc-mcp.tool.call`, attributes per API.md:
 * - `trpc_mcp.tool.name` / `trpc_mcp.tool.path` / `trpc_mcp.tool.type`
 * - `trpc_mcp.transport` (from CallOptions.transport)
 * - `trpc_mcp.result`: ok | error | denied
 * - `trpc_mcp.error.code` on failure
 *
 * Exceptions are recorded by code only - never raw messages or stacks.
 * The returned registry keeps the original type, so tracing composes
 * transparently with typed registries.
 */
export function withTracing<TRegistry extends ToolRegistry>(
  registry: TRegistry,
  options?: TracingOptions,
): TRegistry {
  const tracer: Tracer = trace.getTracer(options?.tracerName ?? "@trpc-mcp/otel");
  const recordIo = options?.recordIo === true;
  const ioLimit = options?.ioAttributeLimit ?? DEFAULT_IO_LIMIT;

  return {
    ...registry,
    async call(
      name: string,
      input: unknown,
      ctx: unknown,
      opts?: CallOptions,
    ): Promise<ToolCallResult> {
      // Resolve the definition up front for span attributes; unknown tools
      // still produce a span with just the requested name.
      const def = registry.definitions().find((d) => d.name === name);

      return tracer.startActiveSpan(SPAN_NAME, async (span) => {
        span.setAttribute("trpc_mcp.tool.name", name);
        if (def !== undefined) {
          span.setAttribute("trpc_mcp.tool.path", def.path);
          span.setAttribute("trpc_mcp.tool.type", def.type);
        }
        if (opts?.transport !== undefined) {
          span.setAttribute("trpc_mcp.transport", opts.transport);
        }
        if (recordIo) {
          span.setAttribute("trpc_mcp.io.input", truncated(input, ioLimit));
        }
        try {
          const result = await registry.call(name, input, ctx, opts);
          if (result.ok) {
            span.setAttribute("trpc_mcp.result", "ok");
            span.setStatus({ code: SpanStatusCode.OK });
            if (recordIo) {
              span.setAttribute("trpc_mcp.io.output", truncated(result.data, ioLimit));
            }
          } else if (result.error?.code === "NOT_FOUND") {
            span.setAttribute("trpc_mcp.result", "denied");
            span.setStatus({ code: SpanStatusCode.ERROR, message: "NOT_FOUND" });
            span.setAttribute("trpc_mcp.error.code", "NOT_FOUND");
          } else {
            span.setAttribute("trpc_mcp.result", "error");
            const code = result.error?.code ?? "INTERNAL";
            span.setStatus({ code: SpanStatusCode.ERROR, message: code });
            span.setAttribute("trpc_mcp.error.code", code);
          }
          return result;
        } catch (err) {
          // The base registry never throws, but a composed wrapper might.
          span.setAttribute("trpc_mcp.result", "error");
          span.setAttribute("trpc_mcp.error.code", "INTERNAL");
          span.setStatus({ code: SpanStatusCode.ERROR, message: "INTERNAL" });
          span.recordException({
            name: "ToolCallFailure",
            message: "tool call failed (details withheld)",
          });
          throw err;
        } finally {
          span.end();
        }
      });
    },
  };
}
