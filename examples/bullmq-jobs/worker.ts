/**
 * BullMQ worker: processes report jobs, reporting progress through
 * job.updateProgress (persisted in Redis; the procedure polls it).
 */

import { Worker } from "bullmq";
import { getConnection, REPORT_QUEUE, type ReportJobData } from "./queue.js";

export function startReportWorker(): Worker<ReportJobData> {
  return new Worker<ReportJobData>(
    REPORT_QUEUE,
    async (job) => {
      const steps = 5;
      for (let step = 1; step <= steps; step++) {
        await job.updateProgress({
          value: Math.round((step / steps) * 100),
          message: `rendering page ${step}/${steps}`,
        });
        await new Promise((r) => setTimeout(r, 30));
      }
      return { url: `https://files.example.test/reports/${job.id}.${job.data.format}` };
    },
    { connection: getConnection() },
  );
}
