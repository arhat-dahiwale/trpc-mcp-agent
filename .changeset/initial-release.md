---
"@trpc-mcp/core": minor
"@trpc-mcp/mcp": minor
"@trpc-mcp/ai-sdk": minor
"@trpc-mcp/otel": minor
---

Initial working release of the toolchain (Phases 0-6).

- **core**: `createToolRegistry` (opt-in exposure via `meta.mcp.expose`, policy
  re-checked on every call, uniform NOT_FOUND for denied/unknown tools, sanitized
  errors, Zod v3/v4 JSON Schema adapter, include/exclude globs, outputSchema from
  `.output()`, progress/cancellation/timeout contract), `mcpProcedure` +
  `ExposedToolNames` + typed `callTool`.
- **mcp**: `createMcpServer` (stdio via `serveStdio`, in-memory, any SDK
  transport), `createHttpHandler` (fetch-style Streamable HTTP, stateless),
  progress notifications, client cancellation.
- **ai-sdk**: `toAiSdkTools` returning a policy-filtered `ToolSet` for ai@7.
- **otel**: `withTracing` span wrapper (`trpc-mcp.tool.call`), I/O opt-in.
