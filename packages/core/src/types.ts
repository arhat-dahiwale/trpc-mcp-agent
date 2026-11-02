/**
 * Public types for @trpc-mcp/core.
 *
 * These describe the tool registry contract shared by every transport
 * adapter (MCP, AI SDK, HTTP). They intentionally avoid tRPC generics so
 * adapters can stay loosely typed at the boundary.
 */

/** A JSON Schema object describing a tool's input (or output). */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

/** Attached to procedures via `.meta({ mcp: { ... } })`. */
export interface McpMeta {
  mcp?: {
    /** Opt-in exposure. A procedure is invisible to agents unless true. */
    expose?: boolean;
    /** Override the derived tool name. */
    name?: string;
    /** Human-facing title. */
    title?: string;
    /** Tool description; falls back to the tRPC procedure description. */
    description?: string;
    /** Free-form tags, surfaced to policy functions. */
    tags?: string[];
    /** MCP annotations (hints for clients, derived from procedure type by default). */
    annotations?: ToolAnnotations;
    /** Marks the tool as long-running; enables the progress contract. */
    longRunning?: boolean;
    /** Hard timeout for calls to this tool, in milliseconds. */
    timeoutMs?: number;
  };
}

/** MCP tool annotations. Defaults derive from the procedure type. */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export type ProcedureType = "query" | "mutation";

/** The `mcp` fragment the registry injects into the context of every call. */
export interface McpToolContext {
  /**
   * Report progress for long-running work. `value` is the amount done,
   * `total` the expected total, `message` optional human-readable status.
   * No-op unless the transport provided a progress sink.
   */
  progress: (value: number, total?: number, message?: string) => void;
  /**
   * Aborts when the client cancels the call or `timeoutMs` elapses.
   * Long-running procedures should observe it and stop early.
   */
  signal: AbortSignal;
}

export interface ToolDefinition {
  /** Tool name, e.g. `notes_search`. */
  name: string;
  /** Original tRPC procedure path, e.g. `notes.search`. */
  path: string;
  type: ProcedureType;
  title?: string;
  description: string;
  inputSchema: JsonSchema;
  /** Present when the procedure defines `.output(...)`. */
  outputSchema?: JsonSchema;
  annotations: ToolAnnotations;
  tags: string[];
  longRunning: boolean;
  timeoutMs?: number;
}

/** Subset of a tool definition passed to policy functions. */
export type ToolInfo = Pick<ToolDefinition, "name" | "path" | "type" | "tags">;

/** A sanitized tool result. Errors never carry stacks or context. */
export interface ToolCallResult {
  ok: boolean;
  data?: unknown;
  error?: { code: ToolErrorCode; message: string };
  durationMs: number;
}

/** Error codes that may cross the boundary. Denied and unknown both map to NOT_FOUND. */
export type ToolErrorCode =
  "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "TIMEOUT" | "CANCELLED" | "INTERNAL";

export type ToolPolicy<Ctx> = (ctx: Ctx, tool: ToolInfo) => boolean | Promise<boolean>;

/** How the tool call reached the registry. Used for tracing and context building. */
export type TransportInfo =
  | { transport: "stdio"; env: NodeJS.ProcessEnv }
  | { transport: "http"; request: Request }
  | { transport: "ai-sdk"; options?: unknown };

export interface CallOptions {
  /** Aborts the call; linked to the procedure's `ctx.mcp.signal`. */
  signal?: AbortSignal;
  /** Receives progress events from `ctx.mcp.progress`. */
  onProgress?: (event: McpProgressEvent) => void;
  /** Logical transport name, used for tracing attributes. */
  transport?: "stdio" | "http" | "ai-sdk" | (string & {});
}

export interface McpProgressEvent {
  progress: number;
  total?: number;
  message?: string;
}

export interface RegistryOptions<TRouter, Ctx> {
  /** The tRPC router whose exposed procedures become tools. */
  router: TRouter;
  /** Builds the context for a connection/request. Called by transport adapters. */
  createContext: (info: TransportInfo) => Ctx | Promise<Ctx>;
  /** Extra visibility filter applied on list AND call. Never a replacement for middleware authz. */
  policy?: ToolPolicy<Ctx>;
  /** Glob patterns (matched against the procedure path) limiting exposure. */
  include?: string[];
  /** Glob patterns (matched against the procedure path) hiding otherwise exposed tools. */
  exclude?: string[];
  /** Override the path-to-name strategy. Must produce valid tool names. */
  nameStrategy?: (path: string) => string;
  /** Replace the default error sanitizer. Return only safe, non-sensitive content. */
  errorFormatter?: (err: unknown) => { code: ToolErrorCode; message: string };
  /** Escape hatch: convert an input/output parser to JSON Schema yourself. */
  convertSchema?: (parser: unknown) => JsonSchema;
}
