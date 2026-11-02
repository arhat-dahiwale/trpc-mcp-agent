import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Test against source so tests run without a prior build of core.
      "@trpc-mcp/core": resolve(import.meta.dirname, "../core/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    typecheck: {
      enabled: true,
      include: ["src/**/*.test-d.ts", "test/**/*.test-d.ts"],
    },
    testTimeout: 15000,
  },
});
