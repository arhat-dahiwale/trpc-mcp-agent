/**
 * Landing page content.
 *
 * The quickstart snippets are copied verbatim from the root README —
 * `content.test.ts` asserts they never drift from the documentation.
 */

export const GITHUB_URL = "https://github.com/arhat-dahiwale/trpc-mcp-agent";
export const GITHUB_BLOB_URL = `${GITHUB_URL}/blob/main`;

export const HERO_HEADLINE = "Expose your tRPC router as an MCP server and AI SDK toolset";

export const HERO_TAGLINE =
  "Write your API once with tRPC and Zod. Claude, Cursor, or any agent calls it safely — your middleware, auth, and validation run unchanged.";

export const INSTALL_COMMAND = "pnpm add @trpc-mcp/core @trpc-mcp/mcp @modelcontextprotocol/sdk";

export const ROUTER_SNIPPET = `// router.ts
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { McpMeta } from "@trpc-mcp/core";

const t = initTRPC.context<{ userId: string | null }>().meta<McpMeta>().create();

export const appRouter = t.router({
  searchNotes: t.procedure
    .meta({ mcp: { expose: true, description: "Search notes by keyword" } })
    .input(z.object({ query: z.string().min(1) }))
    .query(({ input }) => [{ id: "1", title: \`Result for \${input.query}\` }]),
});`;

export const MCP_SERVER_SNIPPET = `// mcp-server.ts
import { serveStdio } from "@trpc-mcp/mcp";
import { appRouter } from "./router";

await serveStdio({
  router: appRouter,
  name: "my-app",
  version: "1.0.0",
  createContext: async () => ({ userId: process.env.USER_ID ?? null }),
});`;

export const INSPECTOR_COMMAND = "npx @modelcontextprotocol/inspector tsx mcp-server.ts";

export type Feature = {
  icon: "shield" | "lock" | "braces" | "progress" | "activity" | "terminal";
  title: string;
  body: string;
};

export const FEATURES: readonly Feature[] = [
  {
    icon: "shield",
    title: "Opt-in exposure & safety model",
    body: "Nothing is visible to agents until a procedure sets meta.mcp.expose. Hidden tools cannot be listed or called — denials are indistinguishable from unknown tools.",
  },
  {
    icon: "lock",
    title: "Auth via your existing middleware",
    body: "Tool calls run through createCaller, so your tRPC middleware, auth, and validation stay the single permission system. No parallel auth to maintain.",
  },
  {
    icon: "braces",
    title: "Zod v3 & v4 to JSON Schema",
    body: "The parsers you already wrote become MCP tool definitions on both Zod lines — input and output schemas included, no duplication.",
  },
  {
    icon: "progress",
    title: "Progress, cancellation & timeouts",
    body: "Long-running tools stream notifications/progress, clients can cancel mid-call, and timeouts bound runaway work. BullMQ recipes included.",
  },
  {
    icon: "activity",
    title: "OpenTelemetry tracing",
    body: "withTracing() wraps the registry with a span on every tool call. Inputs and outputs are never recorded unless you explicitly opt in.",
  },
  {
    icon: "terminal",
    title: "Typed tool names",
    body: "mcpProcedure brands exposed procedures, so callTool() rejects typos and wrong inputs at compile time — the tool name union comes straight from your router.",
  },
] as const;

export type Pkg = { name: string; purpose: string };

export const PACKAGES: readonly Pkg[] = [
  {
    name: "@trpc-mcp/core",
    purpose:
      "Router introspection, Zod to JSON Schema, tool registry, policy filtering, invocation",
  },
  {
    name: "@trpc-mcp/mcp",
    purpose: "MCP server adapter (stdio + Streamable HTTP)",
  },
  {
    name: "@trpc-mcp/ai-sdk",
    purpose: "Vercel AI SDK tool() adapter",
  },
  {
    name: "@trpc-mcp/otel",
    purpose: "OpenTelemetry spans for tool calls (API only)",
  },
] as const;

export const PIPELINE: readonly { title: string; sub: string }[] = [
  { title: "MCP client", sub: "Claude, Cursor, any agent" },
  { title: "AI SDK app", sub: "streamText · generateText" },
  { title: "@trpc-mcp/core", sub: "registry · policy · schemas" },
  { title: "your tRPC router", sub: "middleware → procedure" },
] as const;
