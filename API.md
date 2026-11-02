# API.md

Part 1 is the **public library API** (what gets published). Part 2 covers the **playground and example backend endpoints** (not published).

---

# Part 1: Library API

> Signatures are the design target. Adjust during implementation and update this file in the same change.

## `@trpc-mcp/core`

### `createToolRegistry(options)`
```ts
function createToolRegistry<R extends AnyRouter, Ctx>(
  options: RegistryOptions<R, Ctx>
): ToolRegistry<R, Ctx>;

interface ToolRegistry<R, Ctx> {
  /** All definitions, ignoring policy (for docs and startup logs) */
  definitions(): ToolDefinition[];
  /** Definitions visible to this caller after policy */
  list(ctx: Ctx): Promise<ToolDefinition[]>;
  /** Invoke by tool name. Denied and unknown tools return the same error. */
  call(name: string, input: unknown, ctx: Ctx, opts?: CallOptions): Promise<ToolCallResult>;
}

interface CallOptions {
  signal?: AbortSignal;
  onProgress?: (p: { progress: number; total?: number; message?: string }) => void;
}
```

**Behavior**
- Only procedures with `meta.mcp.expose === true` are included.
- `call` re-checks policy before invoking (list filtering alone is not security).
- Input is validated by the procedure's own Zod parser through `createCaller`.
- Errors are sanitized: `TRPCError` codes map to `{code, message}`; unknown errors become `INTERNAL` with a generic message.

### `McpMeta`
Type for `initTRPC.meta<McpMeta>()`. See DATA.md.

### `zodToJsonSchema(schema)`
Adapter handling Zod v3 and v4.

---

## `@trpc-mcp/mcp`

```ts
function createMcpServer<R, Ctx>(opts: McpServerOptions<R, Ctx>): McpServer;

function serveStdio<R, Ctx>(opts: McpServerOptions<R, Ctx>): Promise<void>;

function createHttpHandler<R, Ctx>(
  opts: McpServerOptions<R, Ctx>
): (req: Request) => Promise<Response>;

interface McpServerOptions<R, Ctx> extends RegistryOptions<R, Ctx> {
  name: string;
  version: string;
  instructions?: string;
}
```

**Protocol mapping**

| MCP method | Behavior |
|---|---|
| `initialize` | Declares `tools` capability |
| `tools/list` | `registry.list(ctx)`, annotations included |
| `tools/call` | `registry.call(...)`; success returns `content: [{type:"text", text: JSON}]` (plus `structuredContent` if output schema exists); failure returns `isError: true` |
| `notifications/progress` | Sent for long-running tools when the client supplies a progress token |

**HTTP handler notes**
- Context is built per request from `TransportInfo.http.request` (headers, cookies, bearer token).
- Works with Express (via adapter), Hono, Next.js Route Handlers, and any fetch-style runtime.

---

## `@trpc-mcp/ai-sdk`

```ts
function toAiSdkTools<R, Ctx>(
  opts: RegistryOptions<R, Ctx> & { context?: Ctx }
): Promise<ToolSet>;
```

- Each exposed procedure becomes `tool({ description, inputSchema, execute })`.
- `execute` calls `registry.call` with the supplied context.
- Errors return a structured error result so the model can recover, rather than throwing.

---

## `@trpc-mcp/otel`

```ts
function withTracing(registry: ToolRegistry, opts?: { tracerName?: string }): ToolRegistry;
```

**Span:** `trpc-mcp.tool.call`

| Attribute | Value |
|---|---|
| `trpc_mcp.tool.name` | tool name |
| `trpc_mcp.tool.path` | procedure path |
| `trpc_mcp.tool.type` | query or mutation |
| `trpc_mcp.transport` | stdio, http, ai-sdk |
| `trpc_mcp.result` | ok, error, denied |
| `trpc_mcp.error.code` | on failure |

Tool input and output are **not** recorded by default. Opt in with `recordIo: true`.

---

## Error codes (sanitized)

`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `TIMEOUT`, `CANCELLED`, `INTERNAL`

Unknown tool and denied tool both return `NOT_FOUND` to avoid leaking hidden tool names.

---

# Part 2: Playground and example backend

Base URL (dev): `http://localhost:3001` (backend), `http://localhost:3000` (playground).

## Auth
Better Auth routes mounted at `/api/auth/*` (sign-in, sign-up, session, organization endpoints).

## tRPC (`/trpc`)
Application procedures used as tools:

| Procedure | Type | Exposed | Notes |
|---|---|---|---|
| `notes.search` | query | yes | `{ query: string, limit?: number }` |
| `notes.create` | mutation | yes | `{ title, body, tags? }` |
| `notes.delete` | mutation | yes | destructive hint, admin and owner only |
| `tasks.list` | query | yes | `{ status? }` |
| `tasks.update` | mutation | yes | `{ id, status }` |
| `reports.generate` | mutation | yes | long-running, returns job handle |
| `reports.status` | query | no | internal, used by UI |

## REST (playground support)

| Method | Path | Description |
|---|---|---|
| GET | `/api/tools` | Tools visible to the current session (after policy) |
| POST | `/api/tools/:name/call` | Invoke a tool with JSON body; logs to `tool_calls` |
| GET | `/api/tool-calls` | Paginated call log (`?tool=&status=&cursor=`) |
| GET | `/api/stats/latency` | Aggregated latency per tool for ECharts |
| GET | `/api/stats/usage` | Call counts over time |
| POST | `/api/chat` | AI SDK streaming chat endpoint (`streamText` with exposed tools) |
| GET | `/health` | Liveness and readiness |

## MCP over HTTP

| Method | Path | Description |
|---|---|---|
| POST/GET/DELETE | `/mcp` | Streamable HTTP MCP endpoint. Auth: `Authorization: Bearer <session or API token>` |

## Socket.IO (`/socket.io`)

| Event | Direction | Payload |
|---|---|---|
| `job:subscribe` | client to server | `{ jobId }` |
| `job:progress` | server to client | `{ jobId, progress, message? }` |
| `job:done` | server to client | `{ jobId, resultUrl }` |
| `job:failed` | server to client | `{ jobId, error }` |
| `toolcall:new` | server to client | `ToolCallRow` (live log) |

Rooms: `org:{organizationId}`, `job:{jobId}`. The Redis adapter handles multi-instance fan-out.