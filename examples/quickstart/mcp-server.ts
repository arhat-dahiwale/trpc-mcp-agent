// Mirrors the README quickstart server (README.md section "Quickstart").
// `serveStdio` runs here exactly as documented; the vitest test drives the
// same options through in-memory + stdio transports instead of a TTY.
import { serveStdio } from "@trpc-mcp/mcp";
import { appRouter } from "./router.js";

export const serverOptions = {
  router: appRouter,
  name: "my-app",
  version: "1.0.0",
  createContext: async () => ({ userId: process.env.USER_ID ?? null }),
};

// Only start when run directly (tsx mcp-server.ts); tests import options.
if (process.env.RUN_QUICKSTART_SERVER === "1") {
  await serveStdio(serverOptions);
}
