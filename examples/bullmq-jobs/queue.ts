/**
 * BullMQ queue wiring for the reports example.
 */

import { Queue } from "bullmq";
import IORedis from "ioredis";

export const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6399";
export const REPORT_QUEUE = "reports";

export type ReportJobData = {
  from: string;
  to: string;
  format: "csv" | "pdf";
};

let connection: IORedis | undefined;

/**
 * Shared ioredis connection. Workers require `maxRetriesPerRequest: null`;
 * see https://docs.bullmq.io/guide/connections.
 */
export function getConnection(): IORedis {
  if (connection === undefined) {
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    // Without a listener, ioredis "error" events crash the process when
    // Redis is unreachable (e.g. the test suite without Docker).
    connection.on("error", (err: Error) => {
      console.warn(`[bullmq-example] redis connection error: ${err.message}`);
    });
  }
  return connection;
}

let queue: Queue<ReportJobData> | undefined;

export function getReportQueue(): Queue<ReportJobData> {
  queue ??= new Queue<ReportJobData>(REPORT_QUEUE, { connection: getConnection() });
  return queue;
}

export async function closeQueues(): Promise<void> {
  await queue?.close();
  queue = undefined;
  await connection?.quit();
  connection = undefined;
}
