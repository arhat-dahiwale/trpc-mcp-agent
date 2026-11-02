# trpc-agent

Expose your existing tRPC router as an **MCP server** and a **Vercel AI SDK toolset**, with one line of setup.

Write your API once with tRPC and Zod. Let Claude, Cursor, or any agent call it safely. Your middleware, auth, and validation run unchanged.

> Status: pre-alpha. See [PHASES.md](./PHASES.md) for the roadmap.

## Why

- Hand-writing MCP tool definitions duplicates schemas you already have in Zod.
- Agents calling your API must go through the same auth and permission checks as your users.
- Long-running work (queues, jobs) needs progress reporting, not timeouts.

## Quickstart

```bash
pnpm add @trpc-mcp/core @trpc-mcp/mcp @modelcontextprotocol/sdk
```

```ts
// router.ts
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { McpMeta } from "@trpc-mcp/core";

const t = initTRPC.context<{ userId: string | null }>().meta<McpMeta>().create();

export const appRouter = t.router({
  searchNotes: t.procedure
    .meta({ mcp: { expose: true, description: "Search notes by keyword" } })
    .input(z.object({ query: z.string().min(1) }))
    .query(({ input }) => [{ id: "1", title: `Result for ${input.query}` }]),
});
```

```ts
// mcp-server.ts
import { serveStdio } from "@trpc-mcp/mcp";
import { appRouter } from "./router";

await serveStdio({
  router: appRouter,
  name: "my-app",
  version: "1.0.0",
  createContext: async () => ({ userId: process.env.USER_ID ?? null }),
});
```

Test it with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector tsx mcp-server.ts
```

This exact quickstart is kept compiling and tested in
[`examples/quickstart`](./examples/quickstart), so the docs never drift.

### Typed tool names (optional)

tRPC v11 does not keep `.meta()` literals in router types, so wrap exposed
procedures with `mcpProcedure()` (identity at runtime, brand at compile time)
to get typo-proof tool names and inferred inputs:

```ts
import { mcpProcedure, callTool } from "@trpc-mcp/core";

const appRouter = t.router({
  searchNotes: mcpProcedure(
    t.procedure
      .meta({ mcp: { expose: true, description: "Search notes by keyword" } })
      .input(z.object({ query: z.string().min(1) }))
      .query(/* ... */),
  ),
});

// `callTool` rejects unknown/hidden names and wrong inputs at compile time:
const result = await callTool(registry, "searchNotes", { query: "pricing" }, ctx);
```

### HTTP (fetch-style)

```ts
import { createHttpHandler } from "@trpc-mcp/mcp";

const handler = createHttpHandler({
  router: appRouter,
  name: "my-app",
  version: "1.0.0",
  createContext: async (info) => {
    // info.transport === "http" -> info.request is the Web Standard Request
    const token = info.request.headers.get("authorization") ?? "";
    return { userId: token === "Bearer ok" ? "u1" : null };
  },
});
// Works with Hono, Next.js Route Handlers, Express (via adapter), Bun, Deno...
```

### Vercel AI SDK

```ts
import { toAiSdkTools } from "@trpc-mcp/ai-sdk";
import { streamText } from "ai";

const tools = await toAiSdkTools({ router: appRouter, createContext: () => ({ userId }) });
const result = streamText({ model, tools, prompt: "Find my notes about pricing" });
```

## Packages

| Package | Purpose |
|---|---|
| `@trpc-mcp/core` | Router introspection, Zod to JSON Schema, tool registry, policy filtering, invocation |
| `@trpc-mcp/mcp` | MCP server adapter (stdio + Streamable HTTP) |
| `@trpc-mcp/ai-sdk` | Vercel AI SDK `tool()` adapter |
| `@trpc-mcp/otel` | OpenTelemetry spans for tool calls (API only) |

## Key design choices

1. **Calls go through `createCaller`.** Your tRPC middleware, auth, and validation are the only permission system.
2. **Opt-in exposure.** A procedure is invisible to agents unless `meta.mcp.expose === true`. Mutations are never exposed implicitly.
3. **Zero runtime deps in core.** tRPC, Zod, MCP SDK, and `ai` are peer dependencies.
4. **BYO observability.** We depend on `@opentelemetry/api` only.

## Repo layout

```
packages/   published libraries
apps/       playground (Next.js) and docs
examples/   Express + Drizzle + BullMQ sample backend
```

## Development

```bash
pnpm install
pnpm dev          # playground + example backend
pnpm test         # vitest (unit + type tests)
pnpm test:e2e     # playwright
pnpm build        # tsup for all packages
pnpm changeset    # record a release note
```

Requirements: Node 20+, pnpm 9+, Docker (for the example backend).

## Docs

- [PRD.md](./PRD.md) product requirements
- [ARCHITECTURE.md](./ARCHITECTURE.md) how it works
- [API.md](./API.md) public API and playground endpoints
- [DATA.md](./DATA.md) types and database schema
- [PHASES.md](./PHASES.md) roadmap
- [AGENTS.md](./AGENTS.md) rules for AI coding agents
- [LOGS.md](./LOGS.md) agent session log

## License

MIT