import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isZodV4Schema, zodToJsonSchema } from "./zod-adapter.js";

/**
 * These tests must pass under BOTH zod v3 and zod v4 (CI matrix):
 * structural assertions are version-agnostic, and the raw snapshot is
 * keyed by the detected major so each matrix cell uses its own snapshot.
 */

const isV4 = isZodV4Schema(z.object({}));

describe("isZodV4Schema", () => {
  it("detects the installed major", () => {
    // The CI matrix installs either zod 3.x or zod 4.x; both must be detected.
    expect(isV4).toBe(typeof (z as { toJSONSchema?: unknown }).toJSONSchema === "function");
  });

  it("rejects non-schemas", () => {
    expect(isZodV4Schema(null)).toBe(false);
    expect(isZodV4Schema({})).toBe(false);
    expect(isZodV4Schema("string")).toBe(false);
  });
});

describe("zodToJsonSchema", () => {
  it("converts a flat object schema", () => {
    const schema = zodToJsonSchema(
      z.object({
        query: z.string().min(1).describe("search text"),
        limit: z.number().int().optional(),
      }),
    );
    expect(schema.type).toBe("object");
    expect(schema.properties).toMatchObject({
      query: { type: "string", description: "search text" },
      // zod v3 emits "number" for int; zod v4 emits "integer"
      limit: { type: expect.stringMatching(/^(number|integer)$/) },
    });
    expect(schema.required).toEqual(["query"]);
  });

  it("always emits an object schema", () => {
    const schema = zodToJsonSchema(z.object({ a: z.string() }));
    expect(schema.type).toBe("object");
  });

  it("handles nested objects, arrays, enums, and defaults", () => {
    const schema = zodToJsonSchema(
      z.object({
        tags: z.array(z.string()),
        status: z.enum(["todo", "done"]),
        note: z.string().default("hello"),
        nested: z.object({ deep: z.boolean() }),
      }),
    );
    expect(schema.properties).toMatchObject({
      tags: { type: "array" },
      status: { type: "string" },
      nested: { type: "object" },
    });
    expect(schema.required).toEqual(["tags", "status", "nested"]);
  });

  it("snapshot (keyed by detected zod major)", () => {
    const schema = zodToJsonSchema(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    );
    expect(schema).toMatchSnapshot(isV4 ? "zod4 search input" : "zod3 search input");
  });
});

describe("zodToJsonSchema error paths", () => {
  it("rejects non-zod parsers with a clear error", () => {
    expect(() => zodToJsonSchema({ notAZodSchema: true })).toThrow();
  });
});
