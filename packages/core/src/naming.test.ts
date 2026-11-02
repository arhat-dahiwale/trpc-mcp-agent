import { describe, expect, it } from "vitest";
import {
  assertNoNameCollisions,
  assertValidToolName,
  defaultNameStrategy,
  MAX_TOOL_NAME_LENGTH,
} from "./naming.js";
import { ToolRegistryError } from "./errors.js";

describe("defaultNameStrategy", () => {
  it("converts dots to underscores", () => {
    expect(defaultNameStrategy("notes.search")).toBe("notes_search");
    expect(defaultNameStrategy("admin.users.delete")).toBe("admin_users_delete");
  });

  it("replaces invalid characters", () => {
    expect(defaultNameStrategy("weird/name here")).toBe("weird_name_here");
    expect(defaultNameStrategy("a+b=c")).toBe("a_b_c");
  });

  it("keeps valid characters untouched", () => {
    expect(defaultNameStrategy("notes_search-1")).toBe("notes_search-1");
  });

  it("truncates to 64 characters", () => {
    const long = "a".repeat(100) + ".b";
    expect(defaultNameStrategy(long)).toHaveLength(MAX_TOOL_NAME_LENGTH);
  });
});

describe("assertValidToolName", () => {
  it("accepts valid names", () => {
    expect(assertValidToolName("notes_search", "notes.search")).toBe("notes_search");
  });

  it("rejects empty names", () => {
    expect(() => assertValidToolName("", "x.y")).toThrow(ToolRegistryError);
  });

  it("rejects names over 64 chars", () => {
    expect(() => assertValidToolName("a".repeat(65), "x.y")).toThrow(/exceeds 64/);
  });

  it("rejects invalid characters", () => {
    expect(() => assertValidToolName("bad.name", "x.y")).toThrow(/invalid characters/);
    expect(() => assertValidToolName("bad name!", "x.y")).toThrow(/invalid characters/);
  });
});

describe("assertNoNameCollisions", () => {
  it("allows distinct names", () => {
    expect(() =>
      assertNoNameCollisions([
        { name: "a_b", path: "a.b" },
        { name: "c_d", path: "c.d" },
      ]),
    ).not.toThrow();
  });

  it("throws with both paths on collision", () => {
    expect(() =>
      assertNoNameCollisions([
        { name: "same", path: "a.b" },
        { name: "same", path: "c.d" },
      ]),
    ).toThrow(/"a\.b".*"c\.d".*"same"/s);
  });
});
