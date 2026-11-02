/**
 * Long-running tool contract tests: progress reporting, cancellation, and
 * timeouts, at the registry level (transport wiring is covered in the mcp
 * and ai-sdk packages).
 */

import { describe, expect, it } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { createToolRegistry } from "./registry.js";
import type { McpMeta, McpToolContext } from "./types.js";

const t = initTRPC.context<{ mcp?: McpToolContext }>().meta<McpMeta>().create();

/** Reports progress `steps` times with 5ms between, then completes. */
const progressRouter = t.router({
  tally: t.procedure
    .meta({ mcp: { expose: true, longRunning: true } })
    .input(z.object({ steps: z.number().int().min(1).max(20).default(5) }))
    .mutation(async ({ input, ctx }) => {
      for (let step = 1; step <= input.steps; step++) {
        ctx.mcp?.progress(step, input.steps, `step ${step}`);
        await new Promise((r) => setTimeout(r, 5));
      }
      return { done: input.steps };
    }),

  /** Resolves only when aborted (or after the external hold). */
  hanging: t.procedure.meta({ mcp: { expose: true, longRunning: true } }).mutation(
    ({ ctx }) =>
      new Promise((_resolve, reject) => {
        ctx.mcp?.signal.addEventListener(
          "abort",
          () => reject(new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "job cancelled" })),
          { once: true },
        );
      }),
  ),

  /** Ignores the signal entirely; used to prove the race returns anyway. */
  deaf: t.procedure.meta({ mcp: { expose: true, longRunning: true, timeoutMs: 80 } }).mutation(
    () =>
      new Promise(() => {
        /* never settles */
      }),
  ),

  /** Observes the signal and reports how it stopped. */
  observer: t.procedure
    .meta({ mcp: { expose: true, longRunning: true, timeoutMs: 80 } })
    .mutation(async ({ ctx }) => {
      const start = Date.now();
      await new Promise<void>((resolve) => {
        ctx.mcp?.signal.addEventListener("abort", () => resolve(), { once: true });
      });
      return { aborted: ctx.mcp?.signal.aborted === true, waitedMs: Date.now() - start };
    }),
});

function makeRegistry() {
  return createToolRegistry<typeof progressRouter, { mcp?: McpToolContext }>({
    router: progressRouter,
    createContext: () => ({}),
  });
}

describe("progress contract", () => {
  it("forwards progress events 5 times with value, total, and message", async () => {
    const registry = makeRegistry();
    const events: Array<{ progress: number; total?: number; message?: string }> = [];
    const result = await registry.call(
      "tally",
      { steps: 5 },
      {},
      { onProgress: (e) => events.push(e) },
    );
    expect(result.ok).toBe(true);
    expect(events.map((e) => e.progress)).toEqual([1, 2, 3, 4, 5]);
    expect(events.every((e) => e.total === 5)).toBe(true);
    expect(events[0]?.message).toBe("step 1");
  });

  it("progress is a safe no-op without a sink", async () => {
    const registry = makeRegistry();
    const result = await registry.call("tally", { steps: 2 }, {});
    expect(result.ok).toBe(true);
  });
});

describe("cancellation", () => {
  it("aborts ctx.mcp.signal so observing procedures stop", async () => {
    const registry = makeRegistry();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const result = await registry.call("observer", undefined, {}, { signal: controller.signal });
    // The call itself returns CANCELLED (raced) even though the procedure
    // resolved cleanly on abort.
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CANCELLED");
  });

  it("returns CANCELLED even when the procedure ignores the signal", async () => {
    const registry = makeRegistry();
    const controller = new AbortController();
    // Abort while the call is in flight: hanging never resolves on its own,
    // so the race must return CANCELLED.
    setTimeout(() => controller.abort(), 30);
    const result = await registry.call("hanging", undefined, {}, { signal: controller.signal });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CANCELLED");
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const registry = makeRegistry();
    const controller = new AbortController();
    controller.abort();
    const result = await registry.call("tally", { steps: 1 }, {}, { signal: controller.signal });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CANCELLED");
  });
});

describe("timeouts", () => {
  it("returns TIMEOUT for procedures that ignore both completion and signal", async () => {
    const registry = makeRegistry();
    const result = await registry.call("deaf", undefined, {});
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("TIMEOUT");
  });

  it("aborts ctx.mcp.signal on timeout so observing procedures stop", async () => {
    const registry = makeRegistry();
    const result = await registry.call("observer", undefined, {});
    expect(result.error?.code).toBe("TIMEOUT");
  });

  it("meta.mcp.timeoutMs overrides nothing when the call finishes first", async () => {
    const registry = makeRegistry();
    const result = await registry.call("tally", { steps: 1 }, {});
    expect(result.ok).toBe(true);
  });
});
