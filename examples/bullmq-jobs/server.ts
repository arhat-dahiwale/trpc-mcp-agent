/**
 * stdio MCP server for the BullMQ example (worker included for the demo).
 *
 * Try with the MCP Inspector:
 *   REDIS_URL=redis://127.0.0.1:6399 npx @modelcontextprotocol/inspector tsx server.ts
 * Then call `reports_generate` and watch progress notifications arrive.
 */

import { serveStdio } from "@trpc-mcp/mcp";
import { jobsRouter } from "./router.js";
import { startReportWorker } from "./worker.js";

const worker = startReportWorker();
worker.on("completed", (job) => {
  // Diagnostics on stderr only - stdout is the protocol channel.
  console.warn(`[worker] completed ${job.id}`);
});

await serveStdio({
  router: jobsRouter,
  name: "bullmq-demo",
  version: "0.1.0",
  instructions: "Long-running report jobs with live progress.",
  createContext: async () => ({}),
});
