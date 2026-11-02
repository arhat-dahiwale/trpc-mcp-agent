# Product Requirements Document: trpc-mcp

## 1. Summary

`trpc-mcp` is a set of npm packages that turn a tRPC router into (a) an MCP server and (b) a Vercel AI SDK toolset, reusing the router's Zod schemas, middleware, and auth.

## 2. Problem

Teams with a tRPC backend who want agents to use it must:
- Re-declare every input schema as MCP tool JSON Schema.
- Re-implement auth and permission checks for the agent path.
- Build custom handling for long-running jobs.
- Add their own tracing.

This duplicates logic and creates security drift between the human API and the agent API.

## 3. Target users

| Persona | Need |
|---|---|
| Full-stack TS dev with a tRPC app | Add agent access in minutes without rewriting the API |
| Platform/security engineer | Guarantee agents obey existing authz, with audit traces |
| AI app builder | Reuse backend procedures as AI SDK tools in `streamText` |

## 4. Goals

- G1: Convert a tRPC router to an MCP server in under 10 lines.
- G2: The same router also yields AI SDK tools.
- G3: Agents are subject to the same middleware and auth as any other caller.
- G4: End-to-end type safety, with tool names and inputs inferred from the router.
- G5: Long-running procedures report progress.
- G6: Every tool call is traceable via OpenTelemetry.
- G7: Ship polished, dual ESM/CJS, fully typed, with provenance on npm.

## 5. Non-goals

- Not an auth library. We reuse the user's tRPC context.
- Not an MCP client or agent framework.
- No support for tRPC subscriptions in v1.
- No hosted service.
- No gRPC or non-tRPC REST conversion.

## 6. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Introspect a tRPC v11 router and list procedures with type, inputs, meta | P0 |
| FR-2 | Convert Zod input schemas (v3 and v4) to JSON Schema | P0 |
| FR-3 | Opt-in exposure via `meta.mcp.expose`; default hidden | P0 |
| FR-4 | Invoke via `createCaller(ctx)` so middleware runs | P0 |
| FR-5 | MCP adapter with stdio transport | P0 |
| FR-6 | MCP adapter with Streamable HTTP transport (fetch-style handler) | P0 |
| FR-7 | Map tRPC errors to MCP tool errors (`isError: true`) with safe messages | P0 |
| FR-8 | AI SDK adapter returning a `ToolSet` | P0 |
| FR-9 | Per-request tool filtering with a policy function using the context | P1 |
| FR-10 | MCP annotations (readOnly, destructive, idempotent) derived from procedure type and overridable | P1 |
| FR-11 | OpenTelemetry spans per tool call | P1 |
| FR-12 | Long-running tools with progress notifications | P1 |
| FR-13 | Name collision handling and deterministic naming | P1 |
| FR-14 | Output schema support when `.output()` is defined | P2 |
| FR-15 | Playground app for live testing | P1 |
| FR-16 | Docs site with quickstart and recipes | P1 |

## 7. Non-functional requirements

- **Compatibility:** Node 20+, tRPC v11, Zod 3.23+ and 4.x, MCP SDK latest stable.
- **Size:** `@trpc-mcp/core` has zero runtime deps and stays under 15 KB min+gzip.
- **Security:** Never leak internal error stacks or context to the agent. Mutations never exposed implicitly.
- **DX:** Hover-inferred tool names, helpful startup warnings, clear errors.
- **Quality:** 90%+ line coverage in core, type tests for all public generics.
- **Supply chain:** npm provenance, lockfile, minimal peer ranges.

## 8. Success metrics

- First working tool from `README` quickstart in under 5 minutes (manual test).
- Published v0.1.0 with passing CI matrix.
- Playground demo recorded as a short GIF in the README.
- Adoption signals: npm downloads, GitHub stars, at least 3 external issues or PRs in the first 3 months.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Name already taken on npm | Check early; fall back to a scoped name |
| Existing similar packages | Differentiate on opt-in safety, auth-by-middleware, progress, tracing |
| tRPC internal API changes (`_def`) | Isolate introspection in one module; contract tests per tRPC minor |
| MCP spec and SDK churn | Peer-depend; keep the adapter thin; pin tested range in CI |
| Zod v3/v4 differences | Adapter layer plus CI matrix |
| Type inference complexity | Start with runtime-correct code; add types incrementally with `expectTypeOf` tests |

## 10. Release plan

- v0.1: core + mcp (stdio) + ai-sdk
- v0.2: HTTP transport + policy + otel
- v0.3: long-running tools
- v1.0: API freeze, docs, playground public

## 11. Open questions

- Should `mcp.expose` support a predicate form (`(ctx) => boolean`) or only booleans plus the registry-level policy?
- Do we support tRPC `.output()` as MCP `outputSchema` in v0.x or defer?
- Resources and prompts: out of scope for v1, or provide helpers?