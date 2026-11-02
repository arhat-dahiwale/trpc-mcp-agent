// Mirrors the README quickstart router (README.md section "Quickstart").
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

export type AppRouter = typeof appRouter;
