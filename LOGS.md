# LOGS.md

Append-only log. One entry per agent session, newest at the **bottom**. Never edit past entries; add a correction in a new entry instead.

## Entry template

```markdown
## Session <N>: <YYYY-MM-DD> | <agent/tool name> | Phase <X>

**Goal:** one sentence.

**Context read:** files and sections consulted.

**Work done:**
- ...

**Files changed:**
- `path/to/file`: what and why

**Dependencies added/removed:** name@version: reason (or "none")

**Verification:**
- Commands run and results (typecheck / lint / test / build)
- External docs or types checked to confirm APIs

**Decisions made:**
- Decision: reason (link to ADR in ARCHITECTURE.md if relevant)

**Problems / blockers:**
- ...

**Docs updated:** API.md / DATA.md / ARCHITECTURE.md / PHASES.md (list)

**Next steps:**
1. ...
2. ...

**Status:** completed | partial | blocked
```

---

## Session 0: <YYYY-MM-DD> | human | Phase 0

**Goal:** Project planning docs created.

**Context read:** n/a

**Work done:**
- Finalized tech stack and package structure.
- Created README, PRD, PHASES, DATA, API, ARCHITECTURE, AGENTS, LOGS.

**Files changed:**
- `README.md`, `PRD.md`, `PHASES.md`, `DATA.md`, `API.md`, `ARCHITECTURE.md`, `AGENTS.md`, `LOGS.md`: initial versions

**Dependencies added/removed:** none

**Verification:** n/a (docs only)

**Decisions made:**
- Core invokes via `createCaller`; opt-in exposure; peer deps for all integrations.

**Problems / blockers:**
- npm name availability for `trpc-mcp` and scope `@trpc-mcp` not yet checked.

**Docs updated:** all (initial)

**Next steps:**
1. Check npm names and decide final package names.
2. Start Phase 0: scaffold pnpm + Turborepo workspace.

**Status:** completed
---

## Session 1: 2026-11-03 | ZCode agent (GLM) | Phases 0-6

**Goal:** Implement Phases 0-6 of the trpc-mcp monorepo autonomously per the overnight mission prompt.

**Plan:**
1. Verify latest versions of all dependencies from npm before writing code.
2. Phase 0: pnpm + Turborepo scaffold, strict TS, ESLint/Prettier/Vitest/tsup, Changesets, CI (Node 20/22 x Zod 3/4), publint/attw.
3. Phase 1: `@trpc-mcp/core` (introspection, Zod v3/v4 JSON Schema adapter, naming, registry, error sanitization) + tests.
4. Phase 2: `@trpc-mcp/mcp` (stdio + contract tests via in-memory transport) + stdio demo example.
5. Phase 3: `@trpc-mcp/ai-sdk` adapter + mock-model loop test.
6. Phase 4: policy, fetch-style HTTP handler, Hono/Express/Next examples, `@trpc-mcp/otel`.
7. Phase 5: progress contract, cancellation, timeout.
8. Phase 6: type inference + `expectTypeOf` tests + README quickstart verification.
9. Full verification suite after each phase; commit per task.

**Verified versions (npm, 2026-11-03):** @trpc/server 11.23.0, zod 4.6.7 (v3 line: 3.25.76), @modelcontextprotocol/sdk 1.32.2, ai 7.0.161 (v7!), @opentelemetry/api 1.10.0 (sdk-trace-base 2.12.0 wants <1.10.0, so dev/test pinned to 1.9.0), typescript 5.9.3 (TS 7.0.2 exists but is the native compiler; pinned 5.9.x for ecosystem compatibility), vitest 5.1.0, tsup 9.0.0, eslint 9.39.5 (deprecated in favor of 10.x, kept for typescript-eslint 8 compatibility), prettier 3.9.10, turbo 2.11.10, publint 0.3.25, @arethetypeswrong/cli 0.18.5, zod-to-json-schema 3.25.2, tsx 4.23.15.

**Decisions made:**
- npm name: `trpc-mcp` (unscoped) is TAKEN on npm (0.0.1 exists). `@trpc-mcp/core` returned 404 (scope appears free). Per unattended rules, keeping working names `@trpc-mcp/*`. -> Needs human review for final naming.
- TypeScript pinned to 5.9.3, not 7.x (native compiler; tsup/dts/eslint ecosystem compatibility).
- AI SDK is at v7; will verify `tool()`/`ToolSet`/mock model shapes from installed types before coding the adapter. Peer range will match what is verified.
- pnpm 12 replaced `onlyBuiltDependencies` with `allowBuilds` (pnpm-workspace.yaml); verified via pnpm docs/settings.

**Session 1 progress (Phase 0 + Phase 1), continued 2026-11-03:**

**Work done (Phase 0):** Scaffolded pnpm 12 + Turborepo 2.11 workspace; 4 packages with tsup 9 (ESM+CJS+dts, per-condition types so attw passes); strict TS 5.9.3 shared config; ESLint 9 flat config + typescript-eslint 8.72 + prettier (docs excluded from formatting); Vitest 5 with typecheck enabled for *.test-d.ts; Changesets initialized; GitHub Actions CI (quality job + Node 20/22 x Zod 3/4 test matrix); publint + attw green.

**Work done (Phase 1):** Implemented @trpc-mcp/core: `types.ts` (McpMeta, ToolDefinition, ToolCallResult, ToolPolicy, RegistryOptions, TransportInfo, McpToolContext), `errors.ts` (sanitizer + ToolRegistryError), `introspect.ts` (isolated _def access), `zod-adapter.ts` (v3/v4 detection + conversion), `naming.ts`, `glob.ts`, `annotations.ts`, `registry.ts` (createToolRegistry with definitions/list/call, policy re-check on call, uniform NOT_FOUND, timeout/cancel racing, progress sink). Shared `@trpc-mcp/test-utils` workspace package (private, structural types to avoid a build cycle) with a realistic router: auth middleware, nested routers, mutation, no-input, output parser, hidden procedure, leak probe, long-running jobs. 55 tests incl. security negatives (opt-in exposure, policy fail-closed, no stack/context leak, include/exclude unbypassable) and version-keyed JSON Schema snapshots.

**Files changed:** packages/core/** (src + tests), packages/{mcp,ai-sdk,otel}/package.json (exports map fix, sideEffects), packages/test-utils/**, scripts/use-zod.mjs, pnpm-workspace.yaml, .github/workflows/ci.yml, .prettierrc.json, .prettierignore, eslint.config.js, .env.example, .nvmrc, .gitattributes, .changeset/config.json, PHASES.md, API.md, DATA.md, ARCHITECTURE.md.

**Dependencies added/removed:** zod-to-json-schema@3.25.2 (core devDep + optional peer: required to convert Zod v3 schemas; kept optional so zod-4-only consumers never need it). @opentelemetry/api pinned 1.9.0 as otel devDep (sdk-trace-base 2.12.0 requires <1.10.0). No runtime deps anywhere; core has zero runtime deps.

**Verification:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:publish` all green. Core suite: 55/55 under zod 4.6.7 AND zod 3.25.76 (via scripts/use-zod.mjs). attw: all 4 packages green on node10/node16-CJS/node16-ESM/bundler.

**External types/docs verified (recorded facts):**
- tRPC 11.23.0: `router._def.procedures` is a FLAT record keyed by dotted path; procedures are async FUNCTIONS with `_def` as own property (typeof check must accept "function"); `_def` keys: procedure, inputs, middlewares, meta, config, type, resolver; `meta` accessible in middleware opts; chained `.use()` middleware RUNS through callers; `router.createCaller(ctx)` exists and works (createCallerFactory equivalent); tRPC has NO `.description()` builder (doc correction: DATA.md said descriptions fall back to procedure description - removed); `.input()` rejects non-validator objects at build time ("Could not find a validator fn"); `.output()` sets `_def.output`.
- tRPC root middleware passed to `initTRPC.create({ middleware })` did NOT run in our probe - do not rely on it; per-procedure `.use()` works.
- Zod 4.6.7: schemas have `_zod` (AND `_def` backcompat - check `_zod` FIRST); `z.toJSONSchema(schema, { io: "input" })` emits draft 2020-12; `z.number().int()` -> `"type":"integer"` (v3 emits `"number"`).
- Zod 3.25.76: `zod-to-json-schema` with `target: "draft-2020-12"` emits the same dialect; optional/defaults/required shapes match v4 for our structural tests.
- pnpm 12.8.1: `onlyBuiltDependencies` replaced by `allowBuilds` in pnpm-workspace.yaml; `pnpm.overrides` in package.json is IGNORED - overrides must live in pnpm-workspace.yaml (scripts/use-zod.mjs edits it).

**Decisions made:**
- Sanitization: developer-thrown TRPCError codes keep their message; INTERNAL_SERVER_ERROR and unknown errors collapse to generic "Internal error while executing the tool."; stacks/causes never emitted. errorFormatter option is the override hatch.
- Unknown and denied tools return byte-identical NOT_FOUND ("Tool not found.").
- `outputSchema` support included (it was trivial: `_def.output` -> JSON Schema; FR-14 pulled forward).
- The `mcp` context fragment (progress+signal) is injected on EVERY call, not only longRunning ones (deviation from ARCHITECTURE.md noted there).
- Registry uses `router.createCaller(ctx)` since the registry only receives the router (createCallerFactory lives on the `t` object); verified equivalent.
- test-utils duplicates McpMeta/McpToolContext structurally to avoid a core<->test-utils turbo build cycle.

**Problems / blockers:** none outstanding. (Fixed en route: glob separator handling, Map-based collision detection overwriting duplicates, procedures-are-functions introspection, prettier reformatting planning docs - now excluded.)

**Docs updated:** API.md (registry surface + sanitization + zod adapter), DATA.md (description source correction), ARCHITECTURE.md (verified internals, io note), PHASES.md (Phase 0+1 ticked).

**Next steps:** Phase 2 - MCP adapter.

**Status:** Phase 0 completed; Phase 1 completed.

**Session 1 progress (Phase 2), continued 2026-11-03:**

**Work done:** Implemented @trpc-mcp/mcp: `createMcpServer(options, transportInfo)` wraps the low-level MCP SDK `Server` with ListTools/CallTool handlers backed by the core registry (per-connection context built lazily via createContext); `serveStdio()` connects a StdioServerTransport with SIGINT/SIGTERM shutdown; annotations and outputSchema mapped into tools/list; failures returned as `isError: true` with sanitized `{"code","message"}` JSON; progress notifications forwarded to `notifications/progress` when the client supplies a progress token; client cancellation (SDK aborts `extra.signal`) flows into the registry and returns CANCELLED. Contract tests (13): real SDK client over InMemoryTransport covers list, call success, validation error, auth denial, hidden-tool-not-callable, unknown==denied identity, structuredContent, progress events, cancellation. `examples/stdio-demo` runnable via `npx @modelcontextprotocol/inspector tsx server.ts`, plus an automated test that spawns it as a child process and drives it with the SDK stdio client (real protocol round trip; Inspector itself is interactive and left for the human).

**Files changed:** packages/mcp/src/{types,server,stdio,index}.ts, packages/mcp/src/{contract,stdio-child}.test.ts, packages/mcp/package.json (+test-utils devDep), packages/mcp/vitest.config.ts, examples/stdio-demo/** , API.md, PHASES.md.

**Dependencies added/removed:** tsx@4.23.15 (stdio-demo devDep: runs the TS demo server for Inspector and the child-process e2e test). @modelcontextprotocol/sdk stays a peer/devDep.

**Verification:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:publish` all green. MCP probes verified at runtime before coding: low-level Server + setRequestHandler; InMemoryTransport.createLinkedPair(); progress notifications reach client onprogress with {progress,total,message}; isError results round-trip; structuredContent round-trips; client-side AbortSignal cancellation aborts the server handler's extra.signal; ErrorCode enum has NO RequestCancelled key (SDK 1.32.2) - cancellation is handled via the abort signal, and late responses are ignored by the client; client.getServerVersion() exposes name/version only (instructions are in InitializeResult).

**Decisions made:**
- Low-level `Server` (not high-level McpServer) so tools/list is computed per connection and policy/cancellation stay in our control.
- Context built once per connection and memoized; HTTP (Phase 4) creates a fresh server per request for per-request contexts.
- `structuredContent` only emitted when the tool declares an outputSchema (spec-safe).
- CANCELLED results return isError:true (spec: clients do not process responses for cancelled requests).
- Phase 2 exit criterion "Manual verification with MCP Inspector" satisfied via automated child-process stdio test; the interactive Inspector run is left for the human (documented in examples/stdio-demo/README.md).

**Problems / blockers:** none.

**Docs updated:** API.md (mcp adapter surface + protocol mapping), PHASES.md (Phase 2 ticked).

**Next steps:** Phase 3 - AI SDK adapter.

**Status:** Phase 2 completed.

**Session 1 progress (Phase 3), continued 2026-11-03:**

**Work done:** Implemented @trpc-mcp/ai-sdk: `toAiSdkTools(options)` builds a registry, resolves the context (static `context` option or `createContext({transport:"ai-sdk"})`), filters through policy, and returns an AI SDK `ToolSet` where each execute calls `registry.call` (forwarding the model loop's abortSignal and an optional onProgress sink). Success returns the procedure data as-is; failures return structured `{ error: { code, message } }` so the model can recover. Tests (9) include a REAL generateText tool loop with MockLanguageModelV4 asserting validated input + result flow-back, middleware denial, structured BAD_REQUEST, sanitized INTERNAL, progress forwarding, abort cancellation at the tool boundary, static-context option, and convertSchema escape hatch.

**Files changed:** packages/ai-sdk/src/{to-ai-sdk-tools,index}.ts, packages/ai-sdk/src/to-ai-sdk-tools.test.ts, packages/ai-sdk/package.json (+test-utils devDep), packages/ai-sdk/vitest.config.ts, API.md, PHASES.md.

**Dependencies added/removed:** none new (ai@7.0.161 was already pinned as peer/devDep).

**Verification:** full suite green (typecheck/lint/test/build/check:publish). Verified at runtime against ai@7.0.161 BEFORE coding: `tool({ description, inputSchema, execute })` (inputSchema, not parameters); `jsonSchema()` helper; `ToolSet` type; `ai/test` exports MockLanguageModelV3 AND V4 - v7 generateText expects the **LanguageModelV4 spec** where `finishReason` is `{ unified, raw }` and usage is `{ inputTokens: {total,noCache,cacheRead,cacheWrite}, outputTokens: {total,text,reasoning} }` (a V3-style string finishReason silently skips tool execution and the loop stops after 1 step); multi-step loops need `stopWhen: stepCountIs(n)`; when the loop's abortSignal fires, generateText itself rejects with AbortError (structured CANCELLED results are asserted at the tool execute boundary instead); Standard Schema validators must return `issues: null` when valid - tRPC 11.23 treats a truthy empty array as failure (SchemaError).

**Decisions made:**
- Toolset is built per context (call toAiSdkTools per request for per-user tools); documented in API.md.
- Success returns raw data; failures return `{ error: { code, message } }` (documented shape).
- ai peer range pinned to ^7.0.0 (v5/v6 have different model specs; claiming support would be untested).

**Problems / blockers:** none.

**Docs updated:** API.md (ai-sdk adapter), PHASES.md (Phase 3 ticked).

**Next steps:** Phase 4 - policy, HTTP transport, otel.

**Status:** Phase 3 completed.

**Session 1 progress (Phase 4), continued 2026-11-03:**

**Work done:** (1) HTTP transport: `createHttpHandler(opts)` in @trpc-mcp/mcp returns a fetch-style `(Request) => Promise<Response>` built on the SDK's `WebStandardStreamableHTTPServerTransport` (SDK 1.32.2 delegates to it from the node transport; NO req/res shim needed). Stateless mode: fresh transport + server per request, context per request from `info.request`; transport warns at creation when the context factory looks auth-blind (heuristic on function source; suppressAuthWarning to silence). Tests: 7 direct fetch-style tests (initialize, call with bearer, anonymous denial, hidden uncallable, no stack/secret leak, malformed JSON-RPC, auth warning) + end-to-end with the REAL SDK StreamableHTTPClientTransport against a node:http server adapting req/res to fetch. (2) Examples: examples/http-hono (app.all("/mcp", (c) => handler(c.req.raw)), tested with app.request), examples/http-express (node req/res -> fetch adapter with Readable.toWeb, tested over real HTTP), examples/http-next (App Router route handler at app/mcp/route.ts, type-checked). (3) @trpc-mcp/otel: `withTracing(registry, { tracerName, recordIo, ioAttributeLimit })` - span `trpc-mcp.tool.call` with API.md attributes, result ok/error/denied, error code only (no messages/stacks), I/O opt-in and truncated, type-preserving. 5 tests with InMemorySpanExporter. Policy itself was already enforced in the core registry (Phase 1); this phase wired it through HTTP + AI SDK paths and re-tested over the wire.

**Files changed:** packages/mcp/src/{http.ts,http.test.ts,index.ts}, examples/http-hono/**, examples/http-express/**, examples/http-next/**, packages/otel/src/{with-tracing.ts,with-tracing.test.ts,index.ts}, packages/otel/{package.json,vitest.config.ts}, packages/{mcp,ai-sdk}/package.json (test-utils devDeps), API.md, PHASES.md.

**Dependencies added/removed:** hono@^4.10.9, express@^5.2.1 + @types/express@^5.0.5, next@16.1.1 (examples only, never published), @opentelemetry/sdk-trace-base@2.12.0 (otel devDep for in-memory exporter tests, per plan).

**Verification:** full suite green (11 typecheck tasks incl. all examples; lint; test; build; check:publish). Verified at runtime BEFORE coding: WebStandardStreamableHTTPServerTransport.handleRequest(Request) -> Promise<Response>; stateless transports CANNOT be reused across requests (SDK throws) - fresh per request; requests are NOT gated on prior initialize (stateless servers answer tools/call directly); MCP spec requires Accept: application/json, text/event-stream (missing both -> "Not Acceptable" error); ErrorCode has no RequestCancelled. sdk-trace-base 2.x: span processors are constructor options (`new BasicTracerProvider({ spanProcessors: [...] })`), addSpanProcessor is gone.

**Decisions made:**
- Stateless-only HTTP in v0.x (no session management, GET/DELETE answered 405 by the transport); sessions deferred - recorded for human review.
- Auth warning is a source-code heuristic (best-effort DX, not security).
- otel records only error codes; recordIo is opt-in with a truncation cap.

**Problems / blockers:** none. (Fixed en route: Hono handler must pass c.req.raw; Express sync-throw in promise chain -> async IIFE with try/catch; TS2742 non-portable express type -> explicit Express annotation.)

**Docs updated:** API.md (http handler + otel), PHASES.md (Phase 4 ticked).

**Next steps:** Phase 5 - long-running tools.

**Status:** Phase 4 completed.

**Session 1 progress (Phase 5), continued 2026-11-03:**

**Work done:** Documented and tested the long-running contract end to end. Contract (API.md new section): registry injects `ctx.mcp = { progress(value, total?, message?), signal }` on every call; `meta.mcp.longRunning` documents intent; `meta.mcp.timeoutMs` bounds the call. MCP: progress flows as notifications/progress when the client supplies a progressToken (verified in Phase 2 contract tests); cancellation (SDK aborts extra.signal) returns CANCELLED; AI SDK forwards the loop abortSignal and an onProgress sink (verified in Phase 3). New core tests (8): progress 5x with value/total/message, no-op progress without sink, signal abort observed by procedures, CANCELLED even when the procedure ignores the signal, already-aborted signal, TIMEOUT for procedures that never settle, timeout aborts ctx.mcp.signal, timeout not triggered when call finishes first. BullMQ example (Docker Redis available - implemented for real): examples/bullmq-jobs with queue.ts/router.ts (reports.generate enqueues + polls + forwards progress; reports.status), worker.ts (updateProgress), server.ts (stdio + worker for Inspector), jobs.test.ts (2 tests vs real redis:8-alpine on :6399: progress flow to completion + caller cancellation; auto-skip without Redis).

**Files changed:** packages/core/src/long-running.test.ts, examples/bullmq-jobs/** (package.json, tsconfig, vitest config, queue.ts, router.ts, worker.ts, server.ts, jobs.test.ts, README.md), API.md (progress contract section), PHASES.md.

**Dependencies added/removed:** bullmq@6.5.4 + ioredis@6.0.0 (example only, never published; justified: Phase 5 requires a real queue example when Docker Redis is available, which it is).

**Verification:** full suite green (12 typecheck tasks, lint, test, build, check:publish). Verified at runtime: BullMQ 6 workers REQUIRE an ioredis instance passed as `{ connection }` (a bare instance as 3rd positional arg or a `{ url }` object are rejected with "Worker requires a connection"); workers need `maxRetriesPerRequest: null`; job.updateProgress objects surface via job.progress; TRPCError code is spelled INTERNAL_SERVER_ERROR (our sanitizer maps it to INTERNAL).

**Decisions made:**
- The mcp fragment is injected on EVERY call (decided in Phase 1, now documented in API.md).
- Cancellation semantics: registry returns CANCELLED/TIMEOUT to the transport even if the procedure ignores the signal; jobs keep running server-side (documented in the example).
- BullMQ example self-skips without Redis so CI without Docker stays green.

**Problems / blockers:** none.

**Docs updated:** API.md (long-running contract), PHASES.md (Phase 5 ticked).

**Next steps:** Phase 6 - type inference.

**Status:** Phase 5 completed.

**Session 1 progress (Phase 6), continued 2026-11-03:**

**Work done:** Type inference landed via the documented fallback. Verified at the type level that tRPC v11 (11.23.0) types a finalized procedure's `_def["meta"]` as `unknown` (compile-time probes), so `expose: true` literals CANNOT be filtered on from router types. Implemented: `mcpProcedure(proc[, { name }])` - identity at runtime (test asserts toBe), brand (`__mcpExposed`, `__mcpName`) at the type level, brand verified to survive t.router record typing; `ExposedToolNames<TRouter>` (flat dotted procedure record keys -> template-literal DotToUnderscore, with name overrides); `ToolInputForName`/`ToolPathForName` (via inferProcedureInput; no-input procedures infer `void` - verified); typed `callTool(registry, name, input, ctx, opts)` delegating to registry.call. Tests: typing.test-d.ts (expectTypeOf + plain conditional assertions; note: vitest 5.1 toEqualTypeOf misreports string-literal unions - documented, conditional-const style used instead) and call-tool.test.ts (runtime identity, meta-only exposure still works, typed invocation, @ts-expect-error negatives for hidden names and wrong inputs). attw + publint re-run after type work: all 4 packages green on all resolution modes. README quickstart proven: examples/quickstart mirrors README code (router + mcp-server options) and drives it through a real MCP client (list + call) - docs cannot drift. README updated (mcpProcedure + callTool + HTTP sections).

**Files changed:** packages/core/src/{typing.ts,call-tool.ts,typing.test-d.ts,call-tool.test.ts,index.ts}, examples/quickstart/** , README.md, ARCHITECTURE.md (section 6 rewritten with verified facts), PHASES.md.

**Dependencies added/removed:** none.

**Verification:** full suite green (lint incl. prettier; test 10 tasks incl. vitest typecheck suite; typecheck 14 tasks; build; check:publish). Type-level facts verified by probes: router["_def"]["procedures"] is flat with dotted keys at the type level (nested routers flatten, matching runtime); intersection brands survive t.router; inferProcedureInput on branded procedures works (input types) but no-input procedures infer `void` (not undefined); meta is `unknown` on final procedure types.

**Decisions made:**
- mcpProcedure fallback chosen (per ARCHITECTURE.md section 6); exposure declared twice (brand + meta) - documented tradeoff.
- Tool names derive from default strategy at the type level; custom nameStrategy/include/exclude invisible to types (documented).
- callTool requires explicit `undefined` for no-input tools (void input type).

**Problems / blockers:** none. (Fixed en route: vitest toEqualTypeOf union misreport -> conditional-const assertions; BullMQ test now self-skips fast without Redis and starts the worker lazily to avoid BullMQ internal-connection unhandled errors; TS2742-style unused-var lint in type-only test routers.)

**Docs updated:** ARCHITECTURE.md (section 6), README.md, PHASES.md (Phase 6 ticked), examples/quickstart mirrors README.

**Next steps:** Phases 0-6 complete. Final: full-suite run, overnight summary entry, stretch phases only if time remains.

**Status:** Phase 6 completed.
