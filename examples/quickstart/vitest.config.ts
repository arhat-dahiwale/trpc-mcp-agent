import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@trpc-mcp/core": resolve(import.meta.dirname, "../../packages/core/src/index.ts"),
      "@trpc-mcp/mcp": resolve(import.meta.dirname, "../../packages/mcp/src/index.ts"),
      "@trpc-mcp/ai-sdk": resolve(import.meta.dirname, "../../packages/ai-sdk/src/index.ts"),
      "@trpc-mcp/test-utils": resolve(
        import.meta.dirname,
        "../../packages/test-utils/src/index.ts",
      ),
    },
  },
  test: {
    include: ["**/*.test.ts"],
    testTimeout: 15000,
  },
});
