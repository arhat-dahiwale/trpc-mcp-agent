# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Codex, etc.) working in this repo. Read this file fully at the start of every session.

## 1. Session protocol

1. Read `AGENTS.md`, then `PHASES.md`, then the last 3 entries in `LOGS.md`.
2. Identify the current phase and the next unchecked task. Work on that task only unless told otherwise.
3. Read `ARCHITECTURE.md`, `API.md`, and `DATA.md` sections relevant to the task before writing code.
4. Make small, reviewable changes. Run checks after each (see section 4).
5. At the end of the session:
   - Tick completed boxes in `PHASES.md`.
   - Update `API.md`, `DATA.md`, or `ARCHITECTURE.md` if behavior changed.
   - Append an entry to `LOGS.md` (required, even if the session failed).

## 2. Project facts

- Monorepo: pnpm workspaces + Turborepo. Use `pnpm`, never `npm` or `yarn`.
- Language: TypeScript strict. No `any` in public APIs. `unknown` plus narrowing is preferred.
- Published packages: `packages/core`, `packages/mcp`, `packages/ai-sdk`, `packages/otel`.
- Unpublished: `apps/playground`, `apps/docs`, `examples/backend`.
- Peer dependencies: `@trpc/server`, `zod`, `@modelcontextprotocol/sdk`, `ai`. Do not move them to `dependencies`.
- Core must keep **zero runtime dependencies**.

## 3. Hard rules

- Invoke procedures only via `createCaller`. Never call resolvers directly or bypass middleware.
- Never expose a procedure that lacks `meta.mcp.expose === true`.
- Never leak stack traces, raw errors, or context to tool results.
- Never log tool inputs or outputs unless an explicit option is on.
- Keep all tRPC `_def` access inside `packages/core/src/introspect.ts`.
- Do not add dependencies without noting the reason in `LOGS.md`. Prefer none.
- Do not hand-edit lockfiles, generated files, or `dist/`.
- Do not commit secrets. Use `.env.example` with placeholders.
- Do not change public API signatures without updating `API.md` and adding a Changeset.
- Do not invent library APIs. If unsure about tRPC, MCP SDK, AI SDK, Better Auth, or Zod behavior, check the installed package's types or official docs, and record what you verified in `LOGS.md`.

## 4. Commands

```bash
pnpm install
pnpm build            # all packages
pnpm typecheck
pnpm lint
pnpm test             # vitest
pnpm test:e2e         # playwright (needs docker compose up)
pnpm check:publish    # publint + attw on built packages
pnpm changeset        # add a release note for public changes
```

Run `pnpm typecheck && pnpm lint && pnpm test` before declaring any task done. If something fails and you cannot fix it, say so in `LOGS.md` rather than hiding it.

## 5. Code style

- ESM source, named exports, no default exports in libraries.
- File names: `kebab-case.ts`. Tests beside source as `*.test.ts`; type tests as `*.test-d.ts`.
- Small pure functions. Side effects only at transport edges.
- Errors: throw typed errors internally, normalize at the boundary.
- Comments explain why, not what. Public APIs get TSDoc.

## 6. Testing expectations

- Every new public function has unit tests.
- Every protocol behavior has a contract test using an MCP SDK client with in-memory transport.
- Changes to generics need `expectTypeOf` tests.
- Security-relevant changes (policy, errors, exposure) need negative tests (hidden tool cannot be called; error does not leak).
- Snapshot JSON Schema output; review diffs, do not blindly update snapshots.

## 7. Commit and PR conventions

- Conventional Commits: `feat(core): ...`, `fix(mcp): ...`, `docs: ...`, `chore: ...`.
- One logical change per commit.
- Public changes require a `.changeset/*.md`.

## 8. When to stop and ask the human

- A decision in PRD "Open questions" blocks progress.
- Required behavior in a doc contradicts another doc.
- A dependency, license, or security tradeoff needs approval.
- The package name or npm scope is unresolved.
- You are about to delete or rewrite more than one package.

## 9. Definition of done (per task)

- [ ] Code implemented and typed
- [ ] Tests added and passing
- [ ] Typecheck and lint clean
- [ ] Docs updated where behavior changed
- [ ] Changeset added if public
- [ ] `PHASES.md` ticked
- [ ] `LOGS.md` entry appended