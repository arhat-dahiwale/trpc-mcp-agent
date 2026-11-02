import { beforeEach, describe, expect, it } from "vitest";
import { createToolRegistry } from "./registry.js";
import { ToolRegistryError } from "./errors.js";
import { resetTestNotes, testContexts, testRouter } from "@trpc-mcp/test-utils";
import { initTRPC } from "@trpc/server";

const registry = createToolRegistry({
  router: testRouter,
  createContext: () => testContexts.member(),
});

beforeEach(() => {
  resetTestNotes();
});

describe("definitions()", () => {
  it("includes only opt-in exposed procedures", () => {
    const names = registry
      .definitions()
      .map((d) => d.name)
      .sort();
    expect(names).toEqual([
      "admin_stats",
      "health_ping",
      "jobs_hanging",
      "jobs_slow",
      "leak",
      "notes_create",
      "notes_destroy",
      "notes_search",
      "unauthorizedThrow",
      "user_get",
      "user_whoami",
    ]);
  });

  it("hides procedures without meta.mcp.expose", () => {
    expect(registry.definitions().some((d) => d.path === "admin.hidden")).toBe(false);
  });

  it("derives names, descriptions and annotations", () => {
    const search = registry.definitions().find((d) => d.name === "notes_search");
    expect(search).toBeDefined();
    expect(search?.path).toBe("notes.search");
    expect(search?.type).toBe("query");
    expect(search?.description).toBe("Search notes by keyword");
    expect(search?.annotations.readOnlyHint).toBe(true);
    expect(search?.annotations.destructiveHint).toBe(false);

    const destroy = registry.definitions().find((d) => d.name === "notes_destroy");
    expect(destroy?.type).toBe("mutation");
    expect(destroy?.annotations.readOnlyHint).toBe(false);
    expect(destroy?.annotations.destructiveHint).toBe(true);
    // meta.mcp.name overrode the derived name
    expect(destroy?.path).toBe("notes.delete");
  });

  it("respects meta annotation overrides", () => {
    const create = registry.definitions().find((d) => d.name === "notes_create");
    expect(create?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
  });

  it("includes outputSchema when .output() is defined", () => {
    const get = registry.definitions().find((d) => d.name === "user_get");
    expect(get?.outputSchema).toBeDefined();
    expect(get?.outputSchema?.type).toBe("object");
    const search = registry.definitions().find((d) => d.name === "notes_search");
    expect(search?.outputSchema).toBeUndefined();
  });

  it("exposes longRunning and timeoutMs from meta", () => {
    const slow = registry.definitions().find((d) => d.name === "jobs_slow");
    expect(slow?.longRunning).toBe(true);
    expect(slow?.timeoutMs).toBe(5000);
  });
});

describe("input schemas", () => {
  it("describes inputs as JSON Schema object", () => {
    const search = registry.definitions().find((d) => d.name === "notes_search");
    expect(search?.inputSchema.type).toBe("object");
    expect(search?.inputSchema.required).toEqual(["query"]);
    expect(search?.inputSchema.properties).toMatchObject({ query: {} });
  });

  it("gives no-input procedures an empty object schema", () => {
    const ping = registry.definitions().find((d) => d.name === "health_ping");
    expect(ping?.inputSchema).toEqual({ type: "object", properties: {} });
  });
});

describe("list(ctx)", () => {
  it("returns all definitions when no policy is set", async () => {
    const visible = await registry.list(testContexts.member());
    expect(visible.length).toBe(registry.definitions().length);
  });
});

describe("call()", () => {
  it("invokes a query through the caller and validates input", async () => {
    const result = await registry.call("notes_search", { query: "pricing" }, testContexts.member());
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([
      { id: "n1", title: "Result for pricing", body: "searched", limit: 5 },
    ]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("runs middleware: anonymous callers get UNAUTHORIZED", async () => {
    const result = await registry.call(
      "notes_create",
      { title: "hello" },
      testContexts.anonymous(),
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("UNAUTHORIZED");
    expect(result.error?.message).toBe("Sign in first.");
  });

  it("runs middleware: authed callers succeed on mutations", async () => {
    const result = await registry.call("notes_create", { title: "hello" }, testContexts.member());
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ id: "n1", createdBy: "u-member" });
  });

  it("supports no-input procedures", async () => {
    const result = await registry.call("health_ping", undefined, testContexts.member());
    expect(result.ok).toBe(true);
    expect(result.data).toBe("pong");
  });

  it("returns BAD_REQUEST for invalid input", async () => {
    const result = await registry.call("notes_search", { query: "" }, testContexts.member());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("BAD_REQUEST");
  });

  it("rejects missing input object", async () => {
    const result = await registry.call("notes_search", undefined, testContexts.member());
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("BAD_REQUEST");
  });
});

describe("registry creation failures", () => {
  it("fails fast on tool name collisions", () => {
    const t = initTRPC
      .context<Record<string, never>>()
      .meta<{ mcp?: { expose?: boolean; name?: string } }>()
      .create();
    // Two procedures explicitly forced onto the same tool name.
    const router = t.router({
      a: t.procedure.meta({ mcp: { expose: true, name: "dup" } }).query(() => 1),
      b: t.procedure.meta({ mcp: { expose: true, name: "dup" } }).query(() => 2),
    });
    expect(() => createToolRegistry({ router, createContext: () => ({}) })).toThrow(
      ToolRegistryError,
    );
    expect(() => createToolRegistry({ router, createContext: () => ({}) })).toThrow(/collision/);
  });

  it("fails fast on invalid meta.mcp.name", () => {
    const t = initTRPC
      .context<Record<string, never>>()
      .meta<{ mcp?: { expose?: boolean; name?: string } }>()
      .create();
    const router = t.router({
      bad: t.procedure.meta({ mcp: { expose: true, name: "not valid!" } }).query(() => 1),
    });
    expect(() => createToolRegistry({ router, createContext: () => ({}) })).toThrow(
      /invalid characters/,
    );
  });

  it("fails fast on parsers it cannot convert", () => {
    const t = initTRPC
      .context<Record<string, never>>()
      .meta<{ mcp?: { expose?: boolean; name?: string } }>()
      .create();
    // A fake Standard Schema: tRPC accepts it as a validator, but the
    // registry's Zod converter cannot turn it into JSON Schema.
    const fakeParser = {
      "~standard": { validate: () => undefined, version: 1 },
    };
    const router = t.router({
      bad: t.procedure
        .meta({ mcp: { expose: true } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .input(fakeParser as any)
        .query(() => 1),
    });
    expect(() => createToolRegistry({ router, createContext: () => ({}) })).toThrow(
      ToolRegistryError,
    );
  });
});

describe("include/exclude filters", () => {
  it("include limits exposure to matching paths", () => {
    const filtered = createToolRegistry({
      router: testRouter,
      createContext: () => testContexts.member(),
      include: ["notes.*", "health.**"],
    });
    const names = filtered
      .definitions()
      .map((d) => d.name)
      .sort();
    expect(names).toEqual(["health_ping", "notes_create", "notes_destroy", "notes_search"]);
  });

  it("exclude hides matching paths", () => {
    const filtered = createToolRegistry({
      router: testRouter,
      createContext: () => testContexts.member(),
      exclude: ["admin.*", "jobs.*", "leak", "unauthorizedThrow", "notes.delete"],
    });
    const names = filtered
      .definitions()
      .map((d) => d.name)
      .sort();
    expect(names).toEqual([
      "health_ping",
      "notes_create",
      "notes_search",
      "user_get",
      "user_whoami",
    ]);
  });
});

describe("convertSchema escape hatch", () => {
  it("lets users convert non-Zod parsers", () => {
    const t = initTRPC
      .context<Record<string, never>>()
      .meta<{ mcp?: { expose?: boolean; name?: string } }>()
      .create();
    // A fake Standard Schema validator that tRPC accepts but Zod conversion
    // cannot handle; the custom convertSchema option takes over.
    const customParser = {
      "~standard": { validate: () => undefined, version: 1 },
    };
    const router = t.router({
      custom: t.procedure
        .meta({ mcp: { expose: true } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .input(customParser as any)
        .query(() => 1),
    });
    const reg = createToolRegistry({
      router,
      createContext: () => ({}),
      convertSchema: (parser) =>
        parser === customParser
          ? { type: "object", properties: { custom: { type: "string" } } }
          : { type: "object", properties: {} },
    });
    expect(reg.definitions()[0]?.inputSchema.properties).toHaveProperty("custom");
  });
});
