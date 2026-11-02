import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";
import { withTracing } from "./with-tracing.js";
import { testContexts, testRouter, type TestContext, type TestRouter } from "@trpc-mcp/test-utils";
import { createToolRegistry, type ToolRegistry } from "@trpc-mcp/core";

const exporter = new InMemorySpanExporter();

// One provider for the whole file (api's global tracer provider is a
// singleton per module graph; setGlobalTracerProvider ignores re-registration).
// sdk-trace-base 2.x takes span processors via constructor options.
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});
trace.setGlobalTracerProvider(provider);

function makeRegistry(): ToolRegistry<TestRouter, TestContext> {
  return createToolRegistry<TestRouter, TestContext>({
    router: testRouter,
    createContext: () => testContexts.member(),
  });
}

async function lastSpan() {
  const spans = exporter.getFinishedSpans();
  return spans[spans.length - 1];
}

describe("withTracing", () => {
  it("records a span per successful call with API.md attributes", async () => {
    const registry = withTracing(makeRegistry(), { tracerName: "test-tracer" });
    const result = await registry.call("notes_search", { query: "x" }, testContexts.member(), {
      transport: "stdio",
    });
    expect(result.ok).toBe(true);
    const span = await lastSpan();
    expect(span?.name).toBe("trpc-mcp.tool.call");
    expect(span?.attributes).toMatchObject({
      "trpc_mcp.tool.name": "notes_search",
      "trpc_mcp.tool.path": "notes.search",
      "trpc_mcp.tool.type": "query",
      "trpc_mcp.transport": "stdio",
      "trpc_mcp.result": "ok",
    });
    // I/O is not recorded by default.
    expect(span?.attributes["trpc_mcp.io.input"]).toBeUndefined();
    expect(span?.attributes["trpc_mcp.io.output"]).toBeUndefined();
  });

  it("records denied and error results without sensitive data", async () => {
    const registry = withTracing(makeRegistry());
    await registry.call("admin_hidden", { secret: "s" }, testContexts.owner());
    const denied = await lastSpan();
    expect(denied?.attributes["trpc_mcp.result"]).toBe("denied");
    expect(denied?.attributes["trpc_mcp.error.code"]).toBe("NOT_FOUND");

    await registry.call("leak", undefined, testContexts.member());
    const failed = await lastSpan();
    expect(failed?.attributes["trpc_mcp.result"]).toBe("error");
    expect(failed?.attributes["trpc_mcp.error.code"]).toBe("INTERNAL");
    const attrs = JSON.stringify(failed?.attributes);
    expect(attrs).not.toContain("postgres");
    expect(attrs).not.toContain("hunter2");
    expect(failed?.status.message).toBe("INTERNAL");
  });

  it("records I/O only when recordIo is on, truncating at the limit", async () => {
    const registry = withTracing(makeRegistry(), { recordIo: true, ioAttributeLimit: 16 });
    await registry.call("notes_search", { query: "secret-search-term" }, testContexts.member());
    const span = await lastSpan();
    const recorded = String(span?.attributes["trpc_mcp.io.input"] ?? "");
    expect(recorded.startsWith('{"query":"s')).toBe(true);
    expect(recorded).toContain("(truncated)");

    // Default limit records the full payload.
    const unlimited = withTracing(makeRegistry(), { recordIo: true });
    await unlimited.call("notes_search", { query: "whole-term" }, testContexts.member());
    const span2 = await lastSpan();
    expect(span2?.attributes["trpc_mcp.io.input"]).toBe('{"query":"whole-term"}');
  });

  it("preserves the registry type and behavior for unknown tools", async () => {
    const registry = withTracing(makeRegistry());
    const result = await registry.call("no_such_tool", {}, testContexts.member());
    expect(result.error?.code).toBe("NOT_FOUND");
    const span = await lastSpan();
    expect(span?.attributes["trpc_mcp.tool.name"]).toBe("no_such_tool");
    expect(span?.attributes["trpc_mcp.tool.path"]).toBeUndefined();
  });

  it("list passes through without spans", async () => {
    const registry = withTracing(makeRegistry());
    const before = exporter.getFinishedSpans().length;
    const defs = await registry.list(testContexts.member());
    expect(defs.length).toBeGreaterThan(0);
    expect(exporter.getFinishedSpans().length).toBe(before);
  });
});
