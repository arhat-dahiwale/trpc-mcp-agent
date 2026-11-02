/**
 * Negative security tests: the properties that must hold no matter what.
 * AGENTS.md requires these to be explicit, not incidental.
 */

import { describe, expect, it } from "vitest";
import { createToolRegistry } from "./registry.js";
import type { ToolPolicy } from "./types.js";
import { testContexts, testRouter, type TestContext, type TestRouter } from "@trpc-mcp/test-utils";

function makeRegistry(overrides?: {
  policy?: ToolPolicy<TestContext>;
  include?: string[];
  exclude?: string[];
}) {
  return createToolRegistry<TestRouter, TestContext>({
    router: testRouter,
    createContext: () => testContexts.member(),
    ...overrides,
  });
}

describe("security: exposure is opt-in", () => {
  it("hidden procedures are not listed", async () => {
    const registry = makeRegistry();
    const visible = await registry.list(testContexts.owner());
    expect(visible.some((d) => d.path === "admin.hidden")).toBe(false);
  });

  it("hidden procedures cannot be called (NOT_FOUND)", async () => {
    const registry = makeRegistry();
    const result = await registry.call("admin_hidden", { secret: "x" }, testContexts.owner());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("unknown tools return NOT_FOUND", async () => {
    const registry = makeRegistry();
    const result = await registry.call("totally_unknown_tool", {}, testContexts.owner());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("denied and unknown tools return the identical error shape", async () => {
    const registry = makeRegistry({
      policy: (_ctx, tool) => tool.name !== "notes_search",
    });
    const denied = await registry.call("notes_search", { query: "x" }, testContexts.member());
    const unknown = await registry.call("no_such_tool", { query: "x" }, testContexts.member());
    expect(denied.error).toEqual(unknown.error);
    expect(denied.error?.code).toBe("NOT_FOUND");
  });
});

describe("security: policy is enforced on call, not just list", () => {
  it("a tool hidden by policy is hidden from list and refused on call", async () => {
    const registry = makeRegistry({
      policy: (ctx, tool) => !(tool.name === "notes_destroy" && ctx.user?.role === "viewer"),
    });
    // list hides it for viewers...
    const visible = await registry.list(testContexts.viewer());
    expect(visible.some((d) => d.name === "notes_destroy")).toBe(false);
    // ...and call still refuses even if the client guesses the name.
    const result = await registry.call("notes_destroy", { id: "n1" }, testContexts.viewer());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("NOT_FOUND");
  });

  it("policy exceptions fail closed", async () => {
    const registry = makeRegistry({
      policy: () => {
        throw new Error("policy engine is down");
      },
    });
    const visible = await registry.list(testContexts.member());
    expect(visible).toEqual([]);
    const result = await registry.call("notes_search", { query: "x" }, testContexts.member());
    expect(result.error?.code).toBe("NOT_FOUND");
  });
});

describe("security: errors never leak internals", () => {
  it("raw internal errors become generic INTERNAL with no sensitive text", async () => {
    const registry = makeRegistry();
    const result = await registry.call("leak", undefined, testContexts.member());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INTERNAL");
    expect(result.error?.message).not.toContain("postgres");
    expect(result.error?.message).not.toContain("hunter2");
    expect(result.error?.message).not.toContain("internals");
    expect(JSON.stringify(result)).not.toContain("stack");
  });

  it("validation errors stay sanitized without stacks", async () => {
    const registry = makeRegistry();
    const result = await registry.call(
      "notes_search",
      { query: 42 }, // wrong type on purpose
      testContexts.member(),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("stack");
    expect(result.error?.code).toBe("BAD_REQUEST");
  });
});

describe("security: include/exclude cannot be bypassed", () => {
  it("excluded procedures are neither listed nor callable", async () => {
    const registry = makeRegistry({ exclude: ["admin.*"] });
    const visible = await registry.list(testContexts.owner());
    expect(visible.some((d) => d.path.startsWith("admin."))).toBe(false);
    const result = await registry.call("admin_stats", undefined, testContexts.owner());
    expect(result.error?.code).toBe("NOT_FOUND");
  });
});
