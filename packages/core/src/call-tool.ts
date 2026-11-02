import type { AnyRouter } from "@trpc/server";
import type { CallOptions, ToolCallResult } from "./types.js";
import type { ToolRegistry } from "./registry.js";
import type { ExposedToolNames, ToolInputForName } from "./typing.js";

/**
 * Typed tool invocation for tests and clients.
 *
 * - `name` must be one of the router's branded exposed tool names (a typo
 *   fails at compile time).
 * - `input` is checked against the procedure's own input type.
 *
 * Runtime behavior is exactly `registry.call`; the registry still validates
 * through tRPC, so an input that satisfies the static type but fails Zod
 * (e.g. runtime refinements) still comes back as a sanitized error result.
 */
export async function callTool<TRouter extends AnyRouter, Ctx, K extends ExposedToolNames<TRouter>>(
  registry: ToolRegistry<TRouter, Ctx>,
  name: K,
  input: ToolInputForName<TRouter, K>,
  ctx: Ctx,
  opts?: CallOptions,
): Promise<ToolCallResult> {
  return registry.call(name as string, input, ctx, opts);
}
