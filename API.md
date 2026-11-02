# API.md

Part 1 is the **public library API** (what gets published). Part 2 covers the **playground and example backend endpoints** (not published).

---

# Part 1: Library API

> Signatures are the design target. Adjust during implementation and update this file in the same change.

## `@trpc-mcp/core`

### `createToolRegistry(options)`
```ts
function createToolRegistry<TRouter extends AnyRouter, Ctx>(
  options: RegistryOptions<TRouter, Ctx>
): ToolRegistry<TRouter, Ctx>;

interface ToolRegistry<TRouter, Ctx> {
  /** All definitions, ignoring policy (for docs and startup logs) */
  definitions(): ToolDefinition[];
  /** Definitions visible to this caller after policy */
  list(ctx: Ctx): Promise<ToolDefinition[]>;
  /** Invoke by tool name. Denied and unknown tools return the same error. */
  call(name: string, input: unknown, ctx: Ctx, opts?: CallOptions): Promise<ToolCallResult>;
  /** The router the registry was built from. */
  readonly router: TRouter;
}

interface CallOptions {
  signal?: AbortSignal;
  onProgress?: (p: { progress: number; total?: number; message?: string }) => void;
  /** Logical transport name; used for tracing attributes ("stdio", "http", "ai-sdk", ...). */
  transport?: "stdio" | "http" | "ai-sdk" | (string & {});
}

interface RegistryOptions<TRouter, Ctx> {
  router: TRouter;
  createContext: (info: TransportInfo) => Ctx | Promise<Ctx>;
  policy?: ToolPolicy<Ctx>;
  include?: string[];            // glob patterns on path
  exclude?: string[];
  nameStrategy?: (path: string) => string;
  errorFormatter?: (err: unknown) => { code: ToolErrorCode; message: string };
  /** Escape hatch: convert an input/output parser to JSON Schema yourself. */
  convertSchema?: (parser: unknown) => JsonSchema;
}
```

**Behavior**
- Only procedures with `meta.mcp.expose === true` are included (subscriptions are always skipped).
- `call` re-checks policy before invoking (list filtering alone is not security).
- Input is validated by the procedure's own Zod parser through the tRPC caller (`router.createCaller(ctx)`, verified equivalent to `t.createCallerFactory(router)(ctx)` in tRPC 11.23.0).
- The registry injects an `mcp` fragment (`{ progress, signal }`) into the context of every call; procedures observe `ctx.mcp.signal` and report via `ctx.mcp.progress`.
- Errors are sanitized: `TRPCError` codes the developer throws intentionally (BAD_REQUEST, PARSE, UNPROCESSABLE_CONTENT, PAYLOAD_TOO_LARGE, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, TIMEOUT, CLIENT_CLOSED_REQUEST) keep their message; everything else becomes `INTERNAL` with a generic message. Stacks and causes never cross the boundary.
- Unknown tool and denied tool return the identical `NOT_FOUND` result (`"Tool not found."`).
- `outputSchema` is included when the procedure defines `.output(...)`.
- Name collisions, invalid names, and unconvertible schemas throw `ToolRegistryError` at creation time.

### `zodToJsonSchema(schema, options?)`
Adapter handling Zod v3 and v4. Auto-detects the major (`_zod` marker for v4; v3 schemas are routed to the optional peer `zod-to-json-schema`). Options: `{ zodMajor?: 3 | 4, io?: "input" | "output" }`. Both majors emit JSON Schema draft 2020-12.

### `McpMeta`
Type for `initTRPC.meta<McpMeta>()`. See DATA.md. Procedures have no description of their own in tRPC v11 (there is no `.description()` builder); the tool description comes from `meta.mcp.description` only.

### `zodToJsonSchema(schema)`
Adapter handling Zod v3 and v4.

---

## `@trpc-mcp/mcp`

```ts
function createMcpServer<TRouter extends AnyRouter, Ctx>(
  opts: McpServerOptions<TRouter, Ctx>,
  transportInfo: TransportInfo
): TrpcMcpServer<TRouter, Ctx>;

function serveStdio<TRouter extends AnyRouter, Ctx>(
  opts: McpServerOptions<TRouter, Ctx>
): Promise<void>;

interface McpServerOptions<TRouter, Ctx> extends RegistryOptions<TRouter, Ctx> {
  name: string;
  version: string;
  instructions?: string;
}

interface TrpcMcpServer<TRouter, Ctx> {
  readonly server: Server;        // low-level MCP SDK server
  readonly registry: ToolRegistry<TRouter, Ctx>;
  readonly transportInfo: TransportInfo;
  connect(transport: Transport): Promise<void>;
  close(): Promise<void>;
}
```

- `createMcpServer` returns the connected-wrapped low-level SDK `Server`; pass it any MCP SDK transport (stdio, in-memory, Streamable HTTP). The context is built once per connection via `createContext` (create a fresh server per HTTP request for per-request contexts).
- `serveStdio` connects a `StdioServerTransport`, installs SIGINT/SIGTERM shutdown, and writes nothing to stdout (protocol channel only).

**Protocol mapping** (verified against @modelcontextprotocol/sdk 1.32.2)

| MCP method | Behavior |
|---|---|
| `initialize` | Handled by the SDK `Server`; declares `tools` capability, sends name/version/instructions |
| `tools/list` | `registry.list(ctx)`, annotations included |
| `tools/call` | `registry.call(...)`; success returns `content: [{type:"text", text: JSON}]` (plus `structuredContent` when the tool declares an `outputSchema`); failure returns `isError: true` with `content` text `{"code","message"}` (sanitized) |
| `notifications/progress` | Sent via `extra.sendNotification` when the client supplies a progress token |
| cancellation | The SDK aborts the handler's `extra.signal`; the registry call returns `CANCELLED` and the late response is `isError: true` (the client has already moved on) |

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