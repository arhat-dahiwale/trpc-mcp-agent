import { generateText, stepCountIs } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it } from "vitest";
import { toAiSdkTools } from "./to-ai-sdk-tools.js";
import {
  resetTestNotes,
  testContexts,
  testRouter,
  type TestContext,
  type TestRouter,
} from "@trpc-mcp/test-utils";
import { initTRPC } from "@trpc/server";

beforeEach(() => resetTestNotes());

/** A mock model that calls `toolName` with `input`, then answers with text. */
function toolCallingModel(toolName: string, input: unknown, steps = 2) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async () => {
      call += 1;
      if (call < steps) {
        return {
          finishReason: { unified: "tool-calls" as const, raw: "tool-calls" },
          usage: v4Usage(),
          content: [
            {
              type: "tool-call" as const,
              toolCallId: `call-${call}`,
              toolName,
              input: JSON.stringify(input),
            },
          ],
          warnings: [],
        };
      }
      return {
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: v4Usage(),
        content: [{ type: "text" as const, text: "done" }],
        warnings: [],
      };
    },
  });
}

function v4Usage() {
  return {
    inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 2, text: 2, reasoning: 0 },
  };
}

describe("toAiSdkTools", () => {
  it("returns a ToolSet with only policy-visible, exposed tools", async () => {
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.member(),
    });
    const names = Object.keys(tools).sort();
    expect(names).toContain("notes_search");
    expect(names).toContain("notes_create");
    expect(names).not.toContain("admin_hidden");

    const hidden = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.viewer(),
      policy: (_ctx, t) => !t.tags.includes("dangerous"),
    });
    expect(Object.keys(hidden)).not.toContain("notes_destroy");
  });

  it("runs a real generateText tool loop with validated input", async () => {
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.member(),
    });
    const result = await generateText({
      model: toolCallingModel("notes_search", { query: "pricing" }),
      tools,
      prompt: "find pricing notes",
      stopWhen: stepCountIs(2),
    });
    expect(result.toolResults.length).toBe(1);
    const first = result.toolResults[0];
    expect(first).toMatchObject({
      toolName: "notes_search",
      // The registry validated and passed the input to the procedure.
      output: [{ id: "n1", title: "Result for pricing", body: "searched", limit: 5 }],
    });
  });

  it("runs middleware: anonymous context yields structured error results", async () => {
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.anonymous(),
    });
    const result = await generateText({
      model: toolCallingModel("notes_create", { title: "hello" }),
      tools,
      prompt: "create a note",
      stopWhen: stepCountIs(2),
    });
    expect(result.toolResults[0]).toMatchObject({
      toolName: "notes_create",
      output: { error: { code: "UNAUTHORIZED", message: "Sign in first." } },
    });
  });

  it("invalid input comes back as a structured BAD_REQUEST the model can recover from", async () => {
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.member(),
    });
    const result = await generateText({
      model: toolCallingModel("notes_search", { query: "" }),
      tools,
      prompt: "search",
      stopWhen: stepCountIs(2),
    });
    const output = (result.toolResults[0] as { output: { error?: { code?: string } } }).output;
    expect(output?.error?.code).toBe("BAD_REQUEST");
  });

  it("internal errors are sanitized", async () => {
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.member(),
    });
    const result = await generateText({
      model: toolCallingModel("leak", {}),
      tools,
      prompt: "leak",
      stopWhen: stepCountIs(2),
    });
    const output = (
      result.toolResults[0] as { output: { error?: { code?: string; message?: string } } }
    ).output;
    expect(output?.error?.code).toBe("INTERNAL");
    expect(JSON.stringify(output)).not.toContain("postgres");
    expect(JSON.stringify(output)).not.toContain("hunter2");
  });

  it("forwards abort signals and progress to the registry", async () => {
    const progressEvents: Array<{ progress: number }> = [];
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.member(),
      onProgress: (event) => progressEvents.push(event),
    });
    const result = await generateText({
      model: toolCallingModel("jobs_slow", { steps: 2 }),
      tools,
      prompt: "run job",
      stopWhen: stepCountIs(2),
    });
    expect(result.toolResults[0]).toMatchObject({ output: { completed: 2 } });
    expect(progressEvents.map((e) => e.progress)).toEqual([1, 2]);
  });

  it("uses the static context option when provided", async () => {
    const context = testContexts.admin();
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => {
        throw new Error("createContext must not be called");
      },
      context,
    });
    expect(Object.keys(tools)).toContain("user_whoami");
  });

  it("cancels tool execution via the abort signal (structured CANCELLED)", async () => {
    const tools = await toAiSdkTools<TestRouter, TestContext>({
      router: testRouter,
      createContext: () => testContexts.member(),
    });
    const controller = new AbortController();
    // Call the tool's execute directly: when the model loop's signal aborts,
    // generateText itself rejects with AbortError (SDK behavior), so the
    // structured CANCELLED result is asserted at the tool boundary.
    const hanging = tools.jobs_hanging as unknown as {
      execute: (input: unknown, options: { abortSignal?: AbortSignal }) => Promise<unknown>;
    };
    setTimeout(() => controller.abort(), 40);
    const output = await hanging.execute({}, { abortSignal: controller.signal });
    expect(output).toEqual({
      error: { code: "CANCELLED", message: "Tool call was cancelled." },
    });
  });
});

describe("toAiSdkTools with other parser libraries", () => {
  it("supports convertSchema for non-Zod parsers", async () => {
    const t = initTRPC
      .context<Record<string, never>>()
      .meta<{ mcp?: { expose?: boolean; description?: string } }>()
      .create();
    // A minimal Standard Schema validator (spec: `issues` must be null when
    // valid - an empty array is treated as failure by tRPC).
    const fakeParser = {
      "~standard": {
        version: 1,
        validate: (value: unknown) => ({ value, issues: null }),
      },
    };
    const router = t.router({
      custom: t.procedure
        .meta({ mcp: { expose: true, description: "custom parser tool" } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .input(fakeParser as any)
        .query(() => 42),
    });
    const tools = await toAiSdkTools<typeof router, Record<string, never>>({
      router,
      createContext: () => ({}),
      convertSchema: (parser) =>
        parser === fakeParser
          ? { type: "object", properties: { custom: { type: "string" } } }
          : { type: "object", properties: {} },
    });
    // The jsonSchema conversion is delegated; ensure the tool exists and runs.
    expect(tools.custom).toBeDefined();
    const result = await generateText({
      model: toolCallingModel("custom", {}),
      tools,
      prompt: "custom",
      stopWhen: stepCountIs(2),
    });
    expect(result.toolResults[0]).toMatchObject({ output: 42 });
  });
});
