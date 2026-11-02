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
