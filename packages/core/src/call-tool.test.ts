/**
 * Runtime behavior of the Phase 6 helpers: mcpProcedure is an identity
 * function (brands are compile-time only) and callTool routes through
 * registry.call with full sanitization.
 */

import { describe, expect, it } from "vitest";
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { mcpProcedure } from "./typing.js";
import { callTool } from "./call-tool.js";
import { createToolRegistry } from "./registry.js";
import type { McpMeta } from "./types.js";
import type { ExposedToolNames, ToolInputForName } from "./typing.js";

const t = initTRPC.context<{ userId: string | null }>().meta<McpMeta>().create();

const appRouter = t.router({
  double: mcpProcedure(
    t.procedure
      .meta({ mcp: { expose: true, description: "doubles a number" } })
      .input(z.object({ n: z.number() }))
      .query(({ input }) => ({ result: input.n * 2 })),
  ),
  ping: mcpProcedure(t.procedure.meta({ mcp: { expose: true } }).query(() => "pong")),
  hidden: t.procedure.query(() => "nope"),
});

describe("mcpProcedure (runtime)", () => {
  it("is an identity function: the procedure is unchanged", () => {
    const proc = t.procedure.query(() => 1);
    expect(mcpProcedure(proc)).toBe(proc);
  });

  it("does not bypass meta requirements: unbranded-but-exposed still registers", () => {
    // Runtime exposure is driven by meta, not the brand.
    const router = t.router({
      metaOnly: t.procedure.meta({ mcp: { expose: true } }).query(() => "via-meta"),
    });
    const registry = createToolRegistry({ router, createContext: () => ({ userId: null }) });
    expect(registry.definitions().map((d) => d.name)).toEqual(["metaOnly"]);
  });
});

describe("callTool (runtime)", () => {
  const registry = createToolRegistry({
    router: appRouter,
    createContext: () => ({ userId: "u1" }),
  });

  it("invokes a tool with typed input", async () => {
    const result = await callTool(registry, "double", { n: 21 }, { userId: "u1" });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ result: 42 });
  });

  it("supports no-input tools with explicit undefined", async () => {
    const result = await callTool(registry, "ping", undefined, { userId: "u1" });
    expect(result.ok).toBe(true);
    expect(result.data).toBe("pong");
  });

  it("still sanitizes errors like registry.call", async () => {
    // The static type would reject this input (see the next test); cast to
    // exercise the runtime path where Zod validation fails instead.
    const badInput = { n: "not-a-number" } as unknown as { n: number };
    const result = await callTool(registry, "double", badInput, { userId: "u1" });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("BAD_REQUEST");
  });

  it("keeps the type-level guarantee: names outside ExposedToolNames are rejected", () => {
    type Names = ExposedToolNames<typeof appRouter>;
    // Compile-time assertions (run under vitest typecheck):
    const ok: "double" | "ping" extends Names ? true : false = true;
    expect(ok).toBe(true);
    // @ts-expect-error "hidden" is not a branded exposed tool name.
    callTool(registry, "hidden", undefined, { userId: "u1" });
    // @ts-expect-error input must match the procedure's input type.
    callTool(registry, "double", { wrong: 1 }, { userId: "u1" });
  });

  it("input type helper agrees with the procedure", () => {
    const input: ToolInputForName<typeof appRouter, "double"> = { n: 3 };
    expect(input).toEqual({ n: 3 });
  });
});
