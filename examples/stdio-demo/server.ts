/**
 * stdio demo: expose a small tRPC router as an MCP server.
 *
 * Try it with the MCP Inspector:
 *
 *   npx @modelcontextprotocol/inspector tsx server.ts
 *
 * Or with any MCP client configured to run: tsx server.ts
 *
 * Context comes from the environment (MCP_USER_ID); middleware runs exactly
 * as it would for a human client.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { McpMeta } from "@trpc-mcp/core";
import { serveStdio } from "@trpc-mcp/mcp";

interface DemoContext {
  userId: string | null;
}

const t = initTRPC.context<DemoContext>().meta<McpMeta>().create();

const requireUser = t.middleware(({ ctx, next }) => {
  // Falsy check, not `=== null`: clients can pass empty env vars, and an
  // empty user id must not count as authentication.
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Set MCP_USER_ID to call this tool." });
  }
  return next();
});

const appRouter = t.router({
  greeting: t.procedure
    .meta({ mcp: { expose: true, description: "Say hello to someone" } })
    .input(z.object({ name: z.string() }))
    .query(({ input }) => ({ hello: input.name })),

  createTask: t.procedure
    .use(requireUser)
    .meta({ mcp: { expose: true, description: "Create a task (requires auth)" } })
    .input(z.object({ title: z.string().min(1) }))
    .mutation(({ input, ctx }) => ({
      id: `task-${Math.random().toString(36).slice(2, 8)}`,
      title: input.title,
      createdBy: ctx.userId,
    })),

  health: t.procedure
    .meta({ mcp: { expose: true, description: "Liveness check" } })
    .query(() => "ok"),

  internal: t.procedure
    .meta({ mcp: { expose: false, description: "Not exposed to agents" } })
    .query(() => "hidden"),
});

await serveStdio({
  router: appRouter,
  name: "stdio-demo",
  version: "0.1.0",
  instructions: "Demo server exposing a tRPC router as MCP tools.",
  createContext: async () => ({
    // `|| null` normalizes an empty MCP_USER_ID to "no user".
    userId: process.env.MCP_USER_ID || null,
  }),
});
