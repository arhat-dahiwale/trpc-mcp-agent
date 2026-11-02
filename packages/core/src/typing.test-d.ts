import { describe, expectTypeOf, it } from "vitest";
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { mcpProcedure } from "./typing.js";
import type {
  DotToUnderscore,
  ExposedToolNames,
  ToolInputForName,
  ToolPathForName,
} from "./typing.js";
import type { McpMeta } from "./types.js";

const t = initTRPC.context<{ userId: string | null }>().meta<McpMeta>().create();

const innerRouter = t.router({
  get: mcpProcedure(
    t.procedure
      .meta({ mcp: { expose: true, description: "get user" } })
      .input(z.object({ id: z.string() }))
      .query(({ input }) => ({ id: input.id, name: "Ada" })),
  ),
  hidden: t.procedure.input(z.object({ secret: z.string() })).query(() => "hidden"),
});

// Only used as a type (typeof) in the assertions below.
export const appRouter = t.router({
  ping: t.procedure.query(() => "pong"),
  searchNotes: mcpProcedure(
    t.procedure
      .meta({ mcp: { expose: true } })
      .input(z.object({ query: z.string(), limit: z.number().optional() }))
      .query(() => [{ id: "n1" }]),
  ),
  custom: mcpProcedure(
    t.procedure.meta({ mcp: { expose: true, name: "custom_name" } }).query(() => 1),
    { name: "custom_name" },
  ),
  createNote: mcpProcedure(
    t.procedure
      .meta({ mcp: { expose: true } })
      .input(z.object({ title: z.string() }))
      .mutation(({ input }) => ({ id: "n2", title: input.title })),
  ),
  inner: innerRouter,
});

describe("DotToUnderscore", () => {
  it("mirrors the default naming strategy", () => {
    const d1: DotToUnderscore<"notes.search"> extends "notes_search" ? true : false = true;
    expectTypeOf(d1).toEqualTypeOf<true>();
    const d2: DotToUnderscore<"a.b.c"> extends "a_b_c" ? true : false = true;
    expectTypeOf(d2).toEqualTypeOf<true>();
    const d3: DotToUnderscore<"flat"> extends "flat" ? true : false = true;
    expectTypeOf(d3).toEqualTypeOf<true>();
  });
});

describe("ExposedToolNames", () => {
  it("is the union of branded exposed tool names only", () => {
    type Names = ExposedToolNames<typeof appRouter>;
    // Plain conditional assertions: vitest's toEqualTypeOf misreports
    // string-literal unions (verified: identical type resolves fine outside).
    const all: Names extends "searchNotes" | "custom_name" | "createNote" | "inner_get"
      ? true
      : false = true;
    const none: never extends Names ? true : false = true;
    expectTypeOf(all).toEqualTypeOf<true>();
    expectTypeOf(none).toEqualTypeOf<true>();
    // Non-branded procedures (even exposed-only-via-meta ones) are absent.
    expectTypeOf<"ping">().not.toExtend<Names>();
    expectTypeOf<"inner_hidden">().not.toExtend<Names>();
  });

  it("applies name overrides from mcpProcedure opts", () => {
    expectTypeOf<"custom_name">().toExtend<ExposedToolNames<typeof appRouter>>();
    expectTypeOf<"custom">().not.toExtend<ExposedToolNames<typeof appRouter>>();
  });
});

describe("ToolInputForName", () => {
  it("infers procedure inputs", () => {
    const searchInput: ToolInputForName<typeof appRouter, "searchNotes"> extends {
      query: string;
      limit?: number | undefined;
    }
      ? true
      : false = true;
    expectTypeOf(searchInput).toEqualTypeOf<true>();
    const createInput: ToolInputForName<typeof appRouter, "createNote"> extends { title: string }
      ? true
      : false = true;
    expectTypeOf(createInput).toEqualTypeOf<true>();
    const innerInput: ToolInputForName<typeof appRouter, "inner_get"> extends { id: string }
      ? true
      : false = true;
    expectTypeOf(innerInput).toEqualTypeOf<true>();
    // No-input procedures infer void in tRPC v11 (verified); callers pass undefined.
    const customInput: ToolInputForName<typeof appRouter, "custom_name"> extends void
      ? true
      : false = true;
    expectTypeOf(customInput).toEqualTypeOf<true>();
  });
});

describe("ToolPathForName", () => {
  it("maps tool names back to procedure paths", () => {
    const p1: ToolPathForName<typeof appRouter, "searchNotes"> extends "searchNotes"
      ? true
      : false = true;
    expectTypeOf(p1).toEqualTypeOf<true>();
    const p2: ToolPathForName<typeof appRouter, "inner_get"> extends "inner.get" ? true : false =
      true;
    expectTypeOf(p2).toEqualTypeOf<true>();
  });
});
