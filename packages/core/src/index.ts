/**
 * @trpc-mcp/core
 *
 * Turn a tRPC router into a tool registry usable by MCP servers, AI SDK
 * agents, or any other transport. Calls always run through tRPC callers so
 * middleware, auth, and validation behave exactly as for human clients.
 */

export { createToolRegistry } from "./registry.js";
export type { ToolRegistry } from "./registry.js";

export { mcpProcedure } from "./typing.js";
export { callTool } from "./call-tool.js";
export type {
  DotToUnderscore,
  ExposedToolNames,
  ToolInputForName,
  ToolPathForName,
} from "./typing.js";

export { isZodV4Schema, zodToJsonSchema } from "./zod-adapter.js";
export type { SchemaConversionOptions } from "./zod-adapter.js";

export { introspectRouter } from "./introspect.js";
export type { IntrospectedProcedure } from "./introspect.js";

export { defaultNameStrategy, MAX_TOOL_NAME_LENGTH, TOOL_NAME_PATTERN } from "./naming.js";
export { pathMatchesGlob, pathMatchesGlobs } from "./glob.js";
export { deriveAnnotations } from "./annotations.js";
export { sanitizeError, ToolRegistryError } from "./errors.js";

export type {
  CallOptions,
  JsonSchema,
  McpMeta,
  McpProgressEvent,
  McpToolContext,
  ProcedureType,
  RegistryOptions,
  ToolAnnotations,
  ToolCallResult,
  ToolDefinition,
  ToolErrorCode,
  ToolInfo,
  ToolPolicy,
  TransportInfo,
} from "./types.js";
