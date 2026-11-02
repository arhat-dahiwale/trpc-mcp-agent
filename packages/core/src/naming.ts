import { ToolRegistryError } from "./errors.js";

/** MCP spec: tool names must match ^[a-zA-Z0-9_-]{1,64}$. */
export const MAX_TOOL_NAME_LENGTH = 64;
export const TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Default naming strategy: `notes.search` -> `notes_search`.
 * Characters outside [a-zA-Z0-9_-] become `_`; the result is truncated to 64
 * characters.
 */
export function defaultNameStrategy(path: string): string {
  const sanitized = path.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized.slice(0, MAX_TOOL_NAME_LENGTH);
}

/**
 * Validate a tool name (from the strategy or a meta override).
 * Returns the name, or throws with a message naming the offending path.
 */
export function assertValidToolName(name: string, path: string): string {
  if (name.length === 0) {
    throw new ToolRegistryError(
      `Tool name for procedure "${path}" is empty. Provide meta.mcp.name or a nameStrategy that produces a non-empty name.`,
    );
  }
  if (name.length > MAX_TOOL_NAME_LENGTH) {
    throw new ToolRegistryError(
      `Tool name "${name}" for procedure "${path}" exceeds ${MAX_TOOL_NAME_LENGTH} characters.`,
    );
  }
  if (!TOOL_NAME_PATTERN.test(name)) {
    throw new ToolRegistryError(
      `Tool name "${name}" for procedure "${path}" contains invalid characters. Allowed: a-z A-Z 0-9 _ -`,
    );
  }
  return name;
}

/**
 * Detect duplicate tool names and fail with both colliding paths in the
 * message, so the operator can fix the collision via meta.mcp.name.
 */
export function assertNoNameCollisions(
  entries: ReadonlyArray<{ name: string; path: string }>,
): void {
  const byName = new Map<string, string>();
  for (const { name, path } of entries) {
    const existing = byName.get(name);
    if (existing !== undefined) {
      throw new ToolRegistryError(
        `Tool name collision: procedures "${existing}" and "${path}" both map to tool name "${name}". Rename one via meta.mcp.name or a custom nameStrategy.`,
      );
    }
    byName.set(name, path);
  }
}
