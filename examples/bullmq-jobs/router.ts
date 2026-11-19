/**
 * Long-running tool backed by BullMQ: the procedure enqueues a report job,
 * then polls the queue and forwards progress to `ctx.mcp.progress` until the
 * job completes. The contract (`ctx.mcp.progress` / `ctx.mcp.signal`) is
 * BullMQ-independent - swap the queue for anything else without touching the
 * transport adapters.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { McpMeta, McpToolContext } from "@trpc-mcp/core";
import { getReportQueue } from "./queue.js";

export interface JobsContext {
  mcp?: McpToolContext;
}

const t = initTRPC.context<JobsContext>().meta<McpMeta>().create();

export const jobsRouter = t.router({
  reports: t.router({
    generate: t.procedure
      .meta({
        mcp: {
          expose: true,
          description: "Generate a report for a date range (long-running)",
          longRunning: true,
          timeoutMs: 30_000,
        },
      })
      .input(
        z.object({
          from: z.string().date(),
          to: z.string().date(),
          format: z.enum(["csv", "pdf"]).default("csv"),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const job = await getReportQueue().add("report", input, {
          removeOnComplete: 10,
          removeOnFail: 10,
        });

        // Poll BullMQ progress and forward it over the transport contract.
        // The worker reports progress via job.updateProgress.
        for (;;) {
          if (ctx.mcp?.signal.aborted) {
            // The client went away; the job keeps running server-side.
            throw new TRPCError({
              code: "CLIENT_CLOSED_REQUEST",
              message: "report cancelled; job continues in background",
            });
          }
          const current = await getReportQueue().getJob(job.id ?? "");
          if (current === undefined) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "job vanished" });
          }
          const state = await current.getState();
          if (state === "completed") {
            // getState() is a live read, but this Job instance is a snapshot
            // fetched earlier - it can predate completion and miss the
            // return value. Re-fetch so the URL is actually present.
            const snapshot = (await getReportQueue().getJob(job.id ?? "")) ?? current;
            const result = snapshot.returnvalue as { url?: string } | undefined;
            return { jobId: current.id ?? "", url: result?.url ?? "", progress: 100 };
          }
          if (state === "failed") {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "report generation failed (details withheld)",
            });
          }
          const progress = current.progress as
            { value?: number; message?: string } | number | undefined;
          if (typeof progress === "object" && typeof progress.value === "number") {
            ctx.mcp?.progress(progress.value, 100, progress.message);
          } else if (typeof progress === "number") {
            ctx.mcp?.progress(progress, 100);
          }
          await new Promise((r) => setTimeout(r, 50));
        }
      }),

    status: t.procedure
      .meta({ mcp: { expose: true, description: "Queue depth snapshot" } })
      .query(async () => {
        const counts = await getReportQueue().getJobCounts("waiting", "active", "completed");
        return {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
        };
      }),
  }),
});
