# Phases

Each phase has a goal, tasks, and exit criteria. Do not start a phase until the previous exit criteria are met. Update the checkboxes and write an entry in LOGS.md after each session.

## Phase 0: Foundation
**Goal:** Working monorepo with CI.
- [ ] Check npm for `trpc-mcp` and `@trpc-mcp` scope availability; decide final names
- [ ] pnpm workspace + Turborepo + shared tsconfig
- [ ] ESLint, Prettier, Vitest base config
- [ ] tsup config template (ESM + CJS + dts)
- [ ] Changesets initialized
- [ ] GitHub Actions: lint, typecheck, test, build on Node 20/22
- [ ] `publint` and `attw` scripts

**Exit:** `pnpm build && pnpm test` green locally and in CI.

## Phase 1: Core
**Goal:** Router to tool registry.
- [ ] Router introspection module (isolates tRPC `_def` access)
- [ ] Zod v3/v4 to JSON Schema adapter
- [ ] `McpMeta` type and `.meta()` integration
- [ ] Naming strategy (`user.get` to `user_get`), collision detection
- [ ] `createToolRegistry()`: list, get, filter
- [ ] `invokeTool()` via `createCaller`
- [ ] Error mapping (TRPCError to safe tool error)
- [ ] Unit tests + snapshot tests of JSON Schemas

**Exit:** A test router produces correct tool definitions, and invocation runs middleware.

## Phase 2: MCP adapter
**Goal:** Real MCP clients can call tools.
- [ ] `createMcpServer()` using the MCP SDK
- [ ] `serveStdio()`
- [ ] `tools/list` and `tools/call` handlers backed by the registry
- [ ] Annotations from procedure type
- [ ] Contract test using an MCP SDK client over in-memory transport
- [ ] Manual verification with MCP Inspector

**Exit:** Inspector lists and calls tools; contract tests pass.

## Phase 3: AI SDK adapter
**Goal:** Same router as AI SDK tools.
- [ ] `toAiSdkTools()` returning a `ToolSet`
- [ ] Per-call context creation
- [ ] Tests with a mock model in `generateText`

**Exit:** `streamText` calls a tool and gets a typed result.

## Phase 4: Policy, HTTP transport, tracing
**Goal:** Production-shaped features.
- [ ] Registry-level `policy(ctx, toolInfo)` filtering for list and call
- [ ] Streamable HTTP handler (`(Request) => Promise<Response>`) with per-request context
- [ ] Express, Hono, and Next.js route examples
- [ ] `@trpc-mcp/otel` spans and attributes
- [ ] Security tests: hidden tools cannot be called, errors do not leak

**Exit:** HTTP example works with auth headers; spans visible in a local collector.

## Phase 5: Long-running tools
**Goal:** Progress reporting for slow work.
- [ ] Define the progress contract (`ctx.mcp.progress`)
- [ ] MCP `notifications/progress` wiring
- [ ] Cancellation via abort signal
- [ ] BullMQ example procedure with progress
- [ ] Timeout configuration

**Exit:** Inspector shows progress for a 10s job; cancel works.

## Phase 6: Type inference
**Goal:** Typed tool names and inputs.
- [ ] Infer a union of exposed tool names from the router type
- [ ] Typed `callTool(name, input)` helper for tests and clients
- [ ] `expectTypeOf` test suite
- [ ] Verify declarations (`attw`) after inference work

**Exit:** Typos in tool names fail at compile time.

## Phase 7: Example backend and playground
**Goal:** Demo app.
- [ ] Example backend (Express + tRPC + Drizzle + Postgres + Redis/BullMQ)
- [ ] Better Auth with orgs and roles
- [ ] Playground Next.js app: tool browser, form-based invocation, call log
- [ ] Chat panel using `useChat` with `toAiSdkTools`
- [ ] Socket.IO progress streaming
- [ ] ECharts latency and usage charts
- [ ] Docker Compose for the whole thing
- [ ] Playwright E2E for core flows

**Exit:** `docker compose up` gives a working demo with role-based tool visibility.

## Phase 8: Docs and observability demo
- [ ] Docs site (quickstart, concepts, recipes, API reference)
- [ ] OpenTelemetry + Prometheus + Grafana demo dashboards
- [ ] README GIF and diagrams

## Phase 9: Release
- [ ] API review and freeze
- [ ] Bundle size and treeshaking check
- [ ] Peer dependency range verification matrix
- [ ] Changesets release PR flow
- [ ] Publish with provenance
- [ ] Announce (GitHub release, MCP and tRPC communities)

## Backlog
- tRPC subscriptions
- MCP resources and prompts helpers
- Output schema support
- OAuth helper recipes for HTTP transport
- CLI: `npx trpc-mcp inspect ./router.ts`