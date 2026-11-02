/**
 * Shared test router used by every package's tests (core registry, MCP
 * contract tests, AI SDK adapter tests).
 *
 * Shape (deliberately varied to exercise the whole surface):
 * - nested routers (`notes.*`, `user.*`, `admin.*`)
 * - a procedure with no input (`health.ping`)
 * - a mutation (`notes.create`, `notes.delete`)
 * - a procedure with an output parser (`user.get`)
 * - a hidden procedure (`admin.hidden`) — not exposed
 * - an internal-error procedure that throws a raw Error with sensitive text
 * - a long-running procedure that reports progress and can be cancelled
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

/**
 * Structural copies of @trpc-mcp/core's `McpMeta` and `McpToolContext`.
 * Duplicated on purpose: a package dependency on core would create a
 * build cycle (core's tests need this router; this router needs core's
 * types only, which are structural).
 */

export interface TestMcpMeta {
  mcp?: {
    expose?: boolean;
    name?: string;
    title?: string;
    description?: string;
    tags?: string[];
    annotations?: {
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
    longRunning?: boolean;
    timeoutMs?: number;
  };
}

export interface TestMcpToolContext {
  progress: (value: number, total?: number, message?: string) => void;
  signal: AbortSignal;
}

export interface TestUser {
  id: string;
  role: "viewer" | "member" | "admin" | "owner";
}

export interface TestContext {
  user: TestUser | null;
  /** The registry injects this fragment; optional for direct callers. */
  mcp?: TestMcpToolContext;
}

export type TestMeta = TestMcpMeta;

const t = initTRPC.context<TestContext>().meta<TestMeta>().create();

/** Auth middleware: runs on every authed procedure, throws when signed out. */
const requireUser = t.middleware(({ ctx, next }) => {
  if (ctx.user === null) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in first." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const publicProcedure = t.procedure;
const authedProcedure = t.procedure.use(requireUser);

// ---------------------------------------------------------------------------

const notes = new Map<string, { id: string; title: string; body: string }>();
let noteSeq = 0;

export function resetTestNotes(): void {
  notes.clear();
  noteSeq = 0;
}

const notesRouter = t.router({
  search: publicProcedure
    .meta({
      mcp: {
        expose: true,
        description: "Search notes by keyword",
        tags: ["notes"],
      },
    })
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    )
    .query(({ input }) => {
      const limit = input.limit ?? 5;
      return [
        {
          id: "n1",
          title: `Result for ${input.query}`,
          body: "searched",
          limit,
        },
      ];
    }),

  create: authedProcedure
    .meta({
      mcp: {
        expose: true,
        description: "Create a note",
        tags: ["notes"],
        annotations: { destructiveHint: false, idempotentHint: false },
      },
    })
    .input(
      z.object({
        title: z.string().min(1),
        body: z.string().default(""),
      }),
    )
    .mutation(({ input, ctx }) => {
      noteSeq += 1;
      const id = `n${noteSeq}`;
      notes.set(id, { id, title: input.title, body: input.body });
      return { id, title: input.title, createdBy: ctx.user.id };
    }),

  delete: authedProcedure
    .meta({
      mcp: {
        expose: true,
        name: "notes_destroy",
        description: "Delete a note by id",
        tags: ["notes", "dangerous"],
      },
    })
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      notes.delete(input.id);
      return { deleted: input.id };
    }),
});

const userRouter = t.router({
  get: authedProcedure
    .meta({
      mcp: {
        expose: true,
        title: "Get user",
        description: "Fetch a user by id",
      },
    })
    .input(z.object({ id: z.string() }))
    .output(z.object({ id: z.string(), name: z.string() }))
    .query(({ input }) => ({ id: input.id, name: "Ada Lovelace" })),

  whoami: authedProcedure
    .meta({ mcp: { expose: true, description: "Current user id" } })
    .query(({ ctx }) => ({ id: ctx.user.id })),
});

const adminRouter = t.router({
  hidden: authedProcedure
    .meta({ mcp: { expose: false, description: "never shown to agents" } })
    .input(z.object({ secret: z.string() }))
    .query(({ input }) => ({ received: input.secret })),

  stats: authedProcedure
    .meta({ mcp: { expose: true, description: "Admin stats" } })
    .query(() => ({ notes: notes.size })),
});

const healthRouter = t.router({
  ping: publicProcedure
    .meta({ mcp: { expose: true, description: "Liveness check" } })
    .query(() => "pong"),
});

const jobsRouter = t.router({
  slow: authedProcedure
    .meta({
      mcp: {
        expose: true,
        description: "Long-running demo job with progress",
        longRunning: true,
        timeoutMs: 5000,
      },
    })
    .input(z.object({ steps: z.number().int().min(1).max(20).default(5) }))
    .mutation(async ({ input, ctx }) => {
      for (let step = 1; step <= input.steps; step++) {
        if (ctx.mcp?.signal.aborted) {
          throw new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "job cancelled" });
        }
        ctx.mcp?.progress(step, input.steps, `step ${step}`);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return { completed: input.steps };
    }),

  hanging: authedProcedure
    .meta({
      mcp: {
        expose: true,
        description: "Resolves only when aborted; used for cancellation tests",
        longRunning: true,
      },
    })
    .input(z.object({ holdMs: z.number().default(60_000) }))
    .mutation(
      ({ input, ctx }) =>
        new Promise((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("hold expired")), input.holdMs);
          ctx.mcp?.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "job cancelled" }));
            },
            { once: true },
          );
        }),
    ),
});

export const testRouter = t.router({
  notes: notesRouter,
  user: userRouter,
  admin: adminRouter,
  health: healthRouter,
  jobs: jobsRouter,

  leak: authedProcedure
    .meta({ mcp: { expose: true, description: "Throws a raw internal error" } })
    .query(() => {
      throw new Error("secret internals: postgres://admin:hunter2@db.internal/prod");
    }),

  unauthorizedThrow: publicProcedure
    .meta({ mcp: { expose: true, description: "Throws UNAUTHORIZED" } })
    .query(() => {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Token expired" });
    }),
});

export type TestRouter = typeof testRouter;

export const testContexts = {
  anonymous: (): TestContext => ({ user: null }),
  viewer: (): TestContext => ({ user: { id: "u-viewer", role: "viewer" } }),
  member: (): TestContext => ({ user: { id: "u-member", role: "member" } }),
  admin: (): TestContext => ({ user: { id: "u-admin", role: "admin" } }),
  owner: (): TestContext => ({ user: { id: "u-owner", role: "owner" } }),
};
