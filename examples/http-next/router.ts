/**
 * Shared router + MCP handler for the Next.js example.
 * Kept in a plain module so route handlers stay thin.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { McpMeta } from "@trpc-mcp/core";
import { createHttpHandler } from "@trpc-mcp/mcp";

export interface ApiContext {
  userId: string | null;
}

const t = initTRPC.context<ApiContext>().meta<McpMeta>().create();

const requireUser = t.middleware(({ ctx, next }) => {
  if (ctx.userId === null) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to call this tool." });
  }
  return next();
});

export const appRouter = t.router({
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

export const mcpHandler = createHttpHandler({
  router: appRouter,
  name: "next-demo",
  version: "0.1.0",
  createContext: async (info) => {
    if (info.transport !== "http") return { userId: null };
    // In a real app verify the session cookie or bearer token here.
    const auth = info.request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return token === "demo-token" ? { userId: "u-next" } : { userId: null };
  },
});
