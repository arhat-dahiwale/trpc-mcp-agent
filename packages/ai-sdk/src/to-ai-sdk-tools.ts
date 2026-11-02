import { createToolRegistry } from "@trpc-mcp/core";
import type { CallOptions, RegistryOptions, TransportInfo } from "@trpc-mcp/core";
import { jsonSchema, tool } from "ai";
import type { ToolSet } from "ai";
import type { AnyRouter } from "@trpc/server";

/**
 * Options for toAiSdkTools: registry options plus a static context.
 *
 * Provide `context` when the toolset is built once for a fixed caller (a
 * worker, a CLI). For per-request tools (a chat endpoint), call
 * `toAiSdkTools` per request with `createContext` reading the request.
 */
export interface AiSdkToolsOptions<TRouter extends AnyRouter, Ctx> extends RegistryOptions<
  TRouter,
  Ctx
> {
  /** Use this context instead of calling createContext. */
  context?: Ctx;
  /** Receives progress events emitted via ctx.mcp.progress. */
  onProgress?: (event: { progress: number; total?: number; message?: string }) => void;
}

const AI_SDK_TRANSPORT: TransportInfo = { transport: "ai-sdk" };

/**
 * Convert the router's exposed procedures into an AI SDK `ToolSet`.
 *
 * - Tools are policy-filtered: only tools visible to the resolved context
 *   are included.
 * - The `inputSchema` is the procedure's own JSON Schema (converted from
 *   Zod). The AI SDK does not validate raw JSON Schemas; validation happens
 *   in tRPC when the caller runs, so invalid input comes back as a
 *   structured error result the model can read and retry.
 * - Success returns the procedure's data as-is; failures return
 *   `{ error: { code, message } }` (sanitized) instead of throwing, so the
 *   model can recover.
 *
 * Verified against ai@7.0.161: `tool({ inputSchema, execute })`,
 * `jsonSchema()`, `ToolSet`, and `MockLanguageModelV4` (LanguageModelV4
 * spec: finishReason is `{ unified, raw }`).
 */
export async function toAiSdkTools<TRouter extends AnyRouter, Ctx>(
  options: AiSdkToolsOptions<TRouter, Ctx>,
): Promise<ToolSet> {
  const registry = createToolRegistry<TRouter, Ctx>(options);
  const ctx = options.context ?? (await options.createContext(AI_SDK_TRANSPORT));
  const visible = await registry.list(ctx);
  const { onProgress } = options;

  const toolSet: ToolSet = {};
  for (const def of visible) {
    toolSet[def.name] = tool({
      description: def.description,
      // ai's jsonSchema() types the parameter as JSONSchema7; our JsonSchema
      // is a structural superset of what we emit (object schemas).
      inputSchema: jsonSchema(def.inputSchema as unknown as Parameters<typeof jsonSchema>[0]),
      execute: async (input: unknown, executeOptions: { abortSignal?: AbortSignal }) => {
        const callOptions: CallOptions = {
          transport: "ai-sdk",
          ...(executeOptions.abortSignal !== undefined
            ? { signal: executeOptions.abortSignal }
            : {}),
          ...(onProgress !== undefined ? { onProgress } : {}),
        };
        const result = await registry.call(def.name, input, ctx, callOptions);
        if (result.ok) {
          return result.data ?? null;
        }
        return {
          error: {
            code: result.error?.code ?? "INTERNAL",
            message: result.error?.message ?? "Internal error.",
          },
        };
      },
    });
  }
  return toolSet;
}
