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
