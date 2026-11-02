import type { ProcedureType, ToolAnnotations } from "./types.js";

/**
 * Derive MCP annotations from the procedure type, then apply meta overrides.
 *
 * Defaults:
 * - query:    readOnlyHint true, destructiveHint false, idempotentHint true
 * - mutation: readOnlyHint false, destructiveHint true,  idempotentHint false
 *
 * Per MCP spec, `destructiveHint` is only meaningful when `readOnlyHint` is
 * false; it is still stored verbatim so clients see what was configured.
 */
export function deriveAnnotations(
  type: ProcedureType,
  override?: ToolAnnotations,
): ToolAnnotations {
  const defaults: ToolAnnotations =
    type === "query"
      ? { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
      : { readOnlyHint: false, destructiveHint: true, idempotentHint: false };
  return { ...defaults, ...override };
}
