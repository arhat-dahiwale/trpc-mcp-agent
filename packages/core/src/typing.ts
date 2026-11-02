/**
 * Type-level helpers for Phase 6 inference.
 *
 * Verified against @trpc/server 11.23.0: a finalized procedure's
 * `_def["meta"]` is typed `unknown`, so `meta.mcp.expose` literals do NOT
 * survive into the router type. The documented fallback (ARCHITECTURE.md
 * section 6) is a brand: wrap exposed procedures with `mcpProcedure()` at
 * the definition site. It is an identity function at runtime - the runtime
 * source of truth remains `meta.mcp.expose === true` - but it carries the
 * brand into the router's procedure record so tool names and inputs can be
 * inferred at compile time.
 */

import type { AnyProcedure, AnyRouter, inferProcedureInput } from "@trpc/server";

/** Brand added by mcpProcedure. */
export interface McpExposedBrand {
  readonly __mcpExposed: true;
}

/** Brand added by mcpProcedure with an explicit tool name override. */
export interface McpNameBrand<Name extends string> {
  readonly __mcpName: Name;
}

/**
 * Mark a procedure as exposed for TYPE INFERENCE ONLY.
 *
 * Runtime exposure still requires `.meta({ mcp: { expose: true } })` - the
 * registry reads meta, not brands. Keep the two in sync; a mismatch fails
 * at runtime (branded but not exposed -> tool missing) or at type level
 * (exposed but not branded -> tool not in ExposedToolNames).
 *
 * With `opts.name`, the inferred tool name uses that override instead of
 * the default dot-to-underscore strategy (mirrors meta.mcp.name).
 */
export function mcpProcedure<T extends AnyProcedure>(procedure: T): T & McpExposedBrand;
export function mcpProcedure<T extends AnyProcedure, Name extends string>(
  procedure: T,
  opts: { name: Name },
): T & McpExposedBrand & McpNameBrand<Name>;
export function mcpProcedure<T extends AnyProcedure>(
  procedure: T,
  _opts?: { name?: string },
): T & McpExposedBrand {
  // The brand is compile-time only; runtime exposure is driven by meta.
  return procedure as T & McpExposedBrand;
}

/** `a.b.c` -> `a_b_c` at the type level (mirrors defaultNameStrategy). */
export type DotToUnderscore<S extends string> = S extends `${infer Head}.${infer Tail}`
  ? `${Head}_${DotToUnderscore<Tail>}`
  : S;

type ProceduresOf<TRouter extends AnyRouter> = TRouter["_def"]["procedures"];

type ExposedEntries<TRouter extends AnyRouter> = {
  [K in keyof ProceduresOf<TRouter> & string]: ProceduresOf<TRouter>[K] extends McpExposedBrand
    ? {
        path: K;
        name: ProceduresOf<TRouter>[K] extends McpNameBrand<infer Name> ? Name : DotToUnderscore<K>;
        input: inferProcedureInput<ProceduresOf<TRouter>[K]>;
      }
    : never;
}[keyof ProceduresOf<TRouter> & string];

/**
 * Union of tool names exposed on this router (branded via mcpProcedure).
 *
 * Assumes the default naming strategy and `mcpProcedure(p, { name })`
 * overrides. Custom `nameStrategy` functions, `include`/`exclude` filters,
 * and `meta.mcp.name` (without the brand) are not visible at the type level.
 */
export type ExposedToolNames<TRouter extends AnyRouter> = ExposedEntries<TRouter>["name"];

/** Input type for a given tool name (from the procedure's own parsers). */
export type ToolInputForName<TRouter extends AnyRouter, K extends string> = Extract<
  ExposedEntries<TRouter>,
  { name: K }
>["input"];

/** Path for a given tool name (debugging/tests). */
export type ToolPathForName<TRouter extends AnyRouter, K extends string> = Extract<
  ExposedEntries<TRouter>,
  { name: K }
>["path"];
