/**
 * Hono example: mount the fetch-style MCP handler at POST /mcp.
 *
 * Hono speaks Web Standard Request/Response, so the handler drops in
 * directly. Run with: pnpm --filter @trpc-mcp/examples-http-hono start
 */

import { Hono } from "hono";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { McpMeta } from "@trpc-mcp/core";
import { createHttpHandler } from "@trpc-mcp/mcp";

interface ApiContext {
  userId: string | null;
}

const t = initTRPC.context<ApiContext>().meta<McpMeta>().create();

const requireUser = t.middleware(({ ctx, next }) => {
  if (ctx.userId === null) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Provide a valid bearer token." });
  }
  return next();
});

const appRouter = t.router({
  greet: t.procedure
    .meta({ mcp: { expose: true, description: "Greet a user by name" } })
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello, ${input.name}!`),

  addTask: t.procedure
    .use(requireUser)
    .meta({ mcp: { expose: true, description: "Add a task (auth required)" } })
    .input(z.object({ title: z.string() }))
    .mutation(({ input, ctx }) => ({ added: input.title, by: ctx.userId })),
});

export const app = new Hono();

// Context per request: read the Authorization header (simple demo auth).
const mcpHandler = createHttpHandler({
  router: appRouter,
  name: "hono-demo",
  version: "0.1.0",
  createContext: async (info) => {
    if (info.transport !== "http") return { userId: null };
    const auth = info.request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    // Replace with real verification in production.
    return token === "demo-token" ? { userId: "u-hono" } : { userId: null };
  },
});

// Hono handlers receive a Context; `c.req.raw` is the Web Standard Request
// the MCP transport expects. GET/DELETE are answered 405 by the handler
// itself (stateless mode has no session to stream to or terminate).
app.all("/mcp", (c) => mcpHandler(c.req.raw));

// The handler is fully fetch-style: `app.fetch` runs on Node (via
// @hono/node-server), Bun, Deno, and Cloudflare Workers unchanged. The
// vitest test below exercises it with app.request directly.
