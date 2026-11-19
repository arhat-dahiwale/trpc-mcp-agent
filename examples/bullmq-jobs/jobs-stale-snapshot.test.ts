/**
 * Regression test: the report procedure reads `getState()` live but the Job
 * instance is a snapshot fetched earlier. When the job completes between the
 * snapshot fetch and the state read, `returnvalue` was missing and the tool
 * returned `url: ""`. The fix re-fetches the job once the state reads
 * "completed". This test scripts exactly that interleaving against a mock
 * queue (the real-Redis flow stays in jobs.test.ts).
 */

import { createToolRegistry } from "@trpc-mcp/core";
import { describe, expect, it, vi } from "vitest";
import type { JobsContext } from "./router.js";

const { add, getJob } = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
}));

vi.mock("./queue.js", () => ({
  REDIS_URL: "redis://mock",
  closeQueues: vi.fn(async () => undefined),
  getReportQueue: () => ({ add, getJob }),
  getConnection: vi.fn(() => ({})),
}));

const { jobsRouter } = await import("./router.js");

const registry = createToolRegistry<typeof jobsRouter, JobsContext>({
  router: jobsRouter,
  createContext: () => ({}),
});

describe("reports_generate completion snapshot", () => {
  it("re-fetches the job before reading the return value", async () => {
    add.mockResolvedValue({ id: "1" });
    // Poll 1 and 2: snapshots taken while the job is active (progress flows).
    // Poll 3: the snapshot predates completion, but the live state read says
    // "completed" - this is the race window.
    // Poll 4 (the re-fetch): a snapshot taken after completion.
    getJob
      .mockResolvedValueOnce({
        id: "1",
        getState: async () => "active",
        progress: { value: 20, message: "rendering page 1/5" },
      })
      .mockResolvedValueOnce({
        id: "1",
        getState: async () => "active",
        progress: { value: 60, message: "rendering page 3/5" },
      })
      .mockResolvedValueOnce({
        id: "1",
        getState: async () => "completed",
        returnvalue: undefined,
      })
      .mockResolvedValue({
        id: "1",
        returnvalue: { url: "https://files.example.test/reports/1.csv" },
      });

    const events: Array<{ progress: number }> = [];
    const result = await registry.call(
      "reports_generate",
      { from: "2026-01-01", to: "2026-01-31", format: "csv" },
      {},
      { onProgress: (e) => events.push({ progress: e.progress }) },
    );

    expect(result.ok).toBe(true);
    const data = result.data as { jobId: string; url: string; progress: number };
    expect(data.jobId).toBe("1");
    expect(data.progress).toBe(100);
    expect(data.url).toBe("https://files.example.test/reports/1.csv");
    expect(events.length).toBeGreaterThanOrEqual(2);
  });
});
