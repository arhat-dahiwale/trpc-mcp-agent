# Phases

Each phase has a goal, tasks, and exit criteria. Do not start a phase until the previous exit criteria are met. Update the checkboxes and write an entry in LOGS.md after each session.

## Phase 0: Foundation
**Goal:** Working monorepo with CI.
- [x] Check npm for `trpc-mcp` and `@trpc-mcp` scope availability; decide final names (trpc-mcp taken; keeping @trpc-mcp/* working names — see LOGS.md)
- [x] pnpm workspace + Turborepo + shared tsconfig
- [x] ESLint, Prettier, Vitest base config
- [x] tsup config template (ESM + CJS + dts)
- [x] Changesets initialized
- [x] GitHub Actions: lint, typecheck, test, build on Node 20/22
- [x] `publint` and `attw` scripts

**Exit:** `pnpm build && pnpm test` green locally and in CI.

## Phase 1: Core
**Goal:** Router to tool registry.
- [x] Router introspection module (isolates tRPC `_def` access)
- [x] Zod v3/v4 to JSON Schema adapter
- [x] `McpMeta` type and `.meta()` integration
- [x] Naming strategy (`user.get` to `user_get`), collision detection
- [x] `createToolRegistry()`: list, get, filter
- [x] `invokeTool()` via `createCaller`
- [x] Error mapping (TRPCError to safe tool error)
- [x] Unit tests + snapshot tests of JSON Schemas

**Exit:** A test router produces correct tool definitions, and invocation runs middleware. ✓ (55 tests pass under both zod 3.25.76 and zod 4.6.7)

## Phase 2: MCP adapter
**Goal:** Real MCP clients can call tools.
- [x] `createMcpServer()` using the MCP SDK
- [x] `serveStdio()`
- [x] `tools/list` and `tools/call` handlers backed by the registry
- [x] Annotations from procedure type
- [x] Contract test using an MCP SDK client over in-memory transport
- [x] Manual verification with MCP Inspector (automated instead: stdio demo spawned as a child process and driven by the SDK stdio client; Inspector is interactive and left for the human - see examples/stdio-demo/README.md)

**Exit:** Inspector lists and calls tools; contract tests pass. ✓ (13 contract tests + real stdio child-process round trip)

## Phase 3: AI SDK adapter
**Goal:** Same router as AI SDK tools.
- [x] `toAiSdkTools()` returning a `ToolSet`
- [x] Per-call context creation
- [x] Tests with a mock model in `generateText`

**Exit:** `streamText` calls a tool and gets a typed result. ✓ (9 tests incl. a real `generateText` tool loop with `MockLanguageModelV4`; streamText shares the same tool/execute path)

## Phase 4: Policy, HTTP transport, tracing
**Goal:** Production-shaped features.
- [x] Registry-level `policy(ctx, toolInfo)` filtering for list and call (built in Phase 1; HTTP/AI SDK adapters apply it)
- [x] Streamable HTTP handler (`(Request) => Promise<Response>`) with per-request context
- [x] Express, Hono, and Next.js route examples (Hono + Express tested; Next type-checked)
- [x] `@trpc-mcp/otel` spans and attributes
- [x] Security tests: hidden tools cannot be called, errors do not leak

**Exit:** HTTP example works with auth headers; spans visible in a local collector. ✓ (HTTP tested directly + via real SDK HTTP client over node:http; spans verified with InMemorySpanExporter; live collector left for the human - see examples)

## Phase 5: Long-running tools
**Goal:** Progress reporting for slow work.
- [x] Define the progress contract (`ctx.mcp.progress`)
- [x] MCP `notifications/progress` wiring
- [x] Cancellation via abort signal
- [x] BullMQ example procedure with progress (Docker Redis available: examples/bullmq-jobs tested against redis:8-alpine; contract stays BullMQ-independent)
- [x] Timeout configuration

**Exit:** Inspector shows progress for a 10s job; cancel works. ✓ (progress verified over real MCP stdio + in-memory transports, AI SDK onProgress, and BullMQ polling; cancellation verified at all three layers; the interactive Inspector run is left for the human - see examples/bullmq-jobs/README.md)

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