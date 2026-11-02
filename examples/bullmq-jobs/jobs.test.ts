/**
 * Test for the BullMQ example. Requires Redis (docker run --rm -p 6399:6379
 * redis:8-alpine). Skips automatically when Redis is unreachable so the
 * suite stays green without Docker.
 */

import { afterAll, describe, expect, it } from "vitest";
import IORedis from "ioredis";
import { createToolRegistry } from "@trpc-mcp/core";
import { jobsRouter, type JobsContext } from "./router.js";
import { startReportWorker } from "./worker.js";
import { closeQueues, REDIS_URL } from "./queue.js";
import type { Worker } from "bullmq";

/** Fails fast (no BullMQ retries) so the suite skips without Redis. */
async function redisAvailable(): Promise<boolean> {
  const probe = new IORedis(REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await probe.connect();
    return probe.status === "ready";
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

// Started lazily: BullMQ workers open their own connections, which emit
// unhandled "error" events when Redis is down. Skip-first avoids that.
let worker: Worker | undefined;
const registry = createToolRegistry<typeof jobsRouter, JobsContext>({
  router: jobsRouter,
  createContext: () => ({}),
});

afterAll(async () => {
  await worker?.close();
  await closeQueues();
});

describe("bullmq long-running tools", () => {
  it("reports progress and completes (skips without Redis)", { timeout: 20_000 }, async () => {
    if (!(await redisAvailable())) {
      console.warn("SKIP: Redis not reachable (start docker redis for this test)");
      return;
    }
    worker = startReportWorker();
    worker.on("error", () => undefined); // skip-failures are asserted via results
    const events: Array<{ progress: number; message?: string }> = [];
    const result = await registry.call(
      "reports_generate",
      { from: "2026-01-01", to: "2026-01-31", format: "csv" },
      {},
      { onProgress: (e) => events.push({ progress: e.progress, message: e.message }) },
    );
    expect(result.ok).toBe(true);
    expect((result.data as { progress: number }).progress).toBe(100);
    expect((result.data as { url: string }).url).toContain("reports/");
    expect(events.some((e) => e.progress > 0 && e.progress < 100)).toBe(true);
  });

  it("cancels the wait when the caller aborts (job continues)", { timeout: 20_000 }, async () => {
    if (!(await redisAvailable())) return;
    worker ??= startReportWorker();
    worker.on("error", () => undefined);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 60);
    const result = await registry.call(
      "reports_generate",
      { from: "2026-02-01", to: "2026-02-28" },
      {},
      { signal: controller.signal },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CANCELLED");
  });
});
