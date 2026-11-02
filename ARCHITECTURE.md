# ARCHITECTURE.md

## 1. Overview

`trpc-mcp` sits between a user's existing tRPC router and any agent runtime. It never reimplements business logic or auth. It translates protocol shapes and delegates execution to tRPC.

```
                 ┌─────────────────────────────┐
 MCP client ───► │  @trpc-mcp/mcp              │
 (Claude, IDE)   │  stdio | Streamable HTTP    │──┐
                 └─────────────────────────────┘  │
                                                  ▼
                 ┌─────────────────────────────┐  ┌────────────────────────┐
 AI SDK app ───► │  @trpc-mcp/ai-sdk           │─►│  @trpc-mcp/core        │
 (streamText)    │  toAiSdkTools()             │  │  ToolRegistry          │
                 └─────────────────────────────┘  │  - introspect          │
                                                  │  - schema convert      │
                 ┌─────────────────────────────┐  │  - policy              │
                 │  @trpc-mcp/otel (wrapper)   │─►│  - call (createCaller) │
                 └─────────────────────────────┘  └───────────┬────────────┘
                                                              ▼
                                                  ┌────────────────────────┐
                                                  │ User's tRPC router     │
                                                  │ middleware → procedure │
                                                  └────────────────────────┘
```

## 2. Package responsibilities

| Package | Depends on | Responsibility |
|---|---|---|
| core | peer: `@trpc/server`, `zod` | Introspection, schema conversion, registry, policy, invocation, error mapping |
| mcp | core; peer: MCP SDK | Protocol adapters and transports |
| ai-sdk | core; peer: `ai` | `ToolSet` generation |
| otel | core; `@opentelemetry/api` | Tracing wrapper |

Rules: adapters depend on core, never on each other. Core imports no adapter.

## 3. Core flow

### Registry creation (startup)
1. Read all procedures from the router (isolated in `introspect.ts`).
2. Filter to `meta.mcp.expose === true`, then apply `include` and `exclude`.
3. Derive tool names, detect collisions, and fail fast.
4. Convert input parsers to JSON Schema (Zod v3 or v4 adapter).
5. Derive annotations: query is read-only; mutation defaults to non-read-only; meta overrides.
6. Freeze the definitions.

### Tool call (runtime)
1. Transport builds a context via `createContext(transportInfo)`.
2. `policy(ctx, tool)` runs. Failure returns `NOT_FOUND`.
3. `router.createCaller(ctx)` is resolved, and the procedure is called by path with the input.
4. tRPC runs its middleware chain and Zod validation.
5. The result or error is normalized to `ToolCallResult`.
6. The transport serializes it (MCP content or AI SDK result).

## 4. Security model

- **Single source of truth:** all authz lives in tRPC middleware. Policy is an extra visibility filter, never a replacement.
- **Opt-in exposure:** nothing is visible by default.
- **List is not security:** `call` always re-runs policy.
- **Uniform denial:** denied and unknown both return `NOT_FOUND`.
- **Error sanitization:** only a mapped code and a safe message leave the process. Stacks and context never do.
- **Tracing privacy:** inputs and outputs not recorded unless enabled.
- **HTTP transport:** requires the user to supply authentication in `createContext`. The library warns if the HTTP handler is created with no context auth.

## 5. Long-running tools

- Procedures that set `meta.mcp.longRunning` receive progress capability via `ctx.mcp` (injected by the registry, merged with user context).
- `ctx.mcp.progress(value, total?, message?)` emits MCP `notifications/progress` when the client supplied a progress token, and calls `onProgress` for the AI SDK path.
- `ctx.mcp.signal` is an `AbortSignal` linked to MCP cancellation and `timeoutMs`.
- In the example backend, the procedure enqueues a BullMQ job, then polls Redis `progress:{jobId}` and forwards updates until completion.

## 6. Type inference strategy

- Phase 1 to 5: runtime-correct with loose types.
- Phase 6: use mapped types over the router's procedure record, filtering by `meta` typing, to produce `ExposedToolName<Router>`.
- Constraint: tRPC meta is typed per-builder, so inference of `expose: true` literals needs `as const` or helper `mcpProcedure()`. Evaluate and document the tradeoff.

## 7. Playground and example backend architecture

```
Browser (Next.js)
  ├─ REST: /api/tools, /api/tools/:name/call, /api/stats/*
  ├─ useChat → /api/chat (streamText + toAiSdkTools)
  └─ Socket.IO ◄── progress / live call log
              │
Express server
  ├─ /api/auth/* (Better Auth, orgs + roles)
  ├─ /trpc (app router, middleware: auth, org, rate limit)
  ├─ /mcp (Streamable HTTP via createHttpHandler)
  ├─ Socket.IO + Redis adapter
  └─ BullMQ producer ──► Worker process (report generation)
              │
   PostgreSQL (Drizzle)     Redis     OTel Collector → Prometheus → Grafana
```

## 8. Build and release

- pnpm workspaces; Turborepo pipeline: `build → typecheck → test`.
- tsup per package: ESM + CJS + `.d.ts`; `exports` map with `types` first.
- Validate with `publint` and `@arethetypeswrong/cli` in CI.
- Changesets drive version PRs; publish job uses npm provenance.
- CI matrix: Node 20/22 × Zod 3/4 × tRPC latest 11.x.

## 9. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | Naming, schema conversion, policy, error mapping |
| Type | Vitest `expectTypeOf` | Inference of tool names and inputs |
| Contract | Vitest + MCP SDK client | Full protocol round trips via in-memory transport |
| Integration | Vitest | Example router with middleware and auth contexts |
| E2E | Playwright | Playground flows, role-based visibility |

## 10. Key decisions (ADR summary)

| # | Decision | Reason |
|---|---|---|
| 1 | Use `createCaller` for invocation | Reuses middleware; no duplicate authz |
| 2 | Opt-in exposure | Safer default for agent access |
| 3 | Peer deps for tRPC, Zod, MCP SDK, ai | Avoid duplicate installs and version skew |
| 4 | Fetch-style HTTP handler | Runs on Node, Bun, Deno, edge |
| 5 | `@opentelemetry/api` only | Users choose their exporter |
| 6 | No auth package | Context already carries identity |
| 7 | Isolate tRPC internals in one file | Contain breakage on tRPC changes |