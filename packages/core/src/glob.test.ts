import { describe, expect, it } from "vitest";
import { pathMatchesGlob, pathMatchesGlobs } from "./glob.js";

describe("pathMatchesGlob", () => {
  it("matches literal paths exactly", () => {
    expect(pathMatchesGlob("leak", "leak")).toBe(true);
    expect(pathMatchesGlob("leak", "leaks")).toBe(false);
    expect(pathMatchesGlob("notes.search", "notes.search")).toBe(true);
    expect(pathMatchesGlob("notes.create", "notes.search")).toBe(false);
  });

  it("* matches one segment", () => {
    expect(pathMatchesGlob("notes.search", "notes.*")).toBe(true);
    expect(pathMatchesGlob("notes.search.deep", "notes.*")).toBe(false);
    expect(pathMatchesGlob("notes", "notes.*")).toBe(false);
  });

  it("** matches zero or more trailing segments", () => {
    expect(pathMatchesGlob("health.ping", "health.**")).toBe(true);
    expect(pathMatchesGlob("health", "health.**")).toBe(true);
    expect(pathMatchesGlob("health.a.b.c", "health.**")).toBe(true);
    expect(pathMatchesGlob("adminx.ping", "health.**")).toBe(false);
  });

  it("** matches zero or more middle segments", () => {
    expect(pathMatchesGlob("admin.users.delete", "admin.**.delete")).toBe(true);
    expect(pathMatchesGlob("admin.delete", "admin.**.delete")).toBe(true);
    expect(pathMatchesGlob("admin.users.rename", "admin.**.delete")).toBe(false);
    expect(pathMatchesGlob("user.notes.delete", "**.delete")).toBe(true);
    expect(pathMatchesGlob("delete", "**.delete")).toBe(true);
  });

  it("bare ** matches everything", () => {
    expect(pathMatchesGlob("anything", "**")).toBe(true);
    expect(pathMatchesGlob("a.b.c", "**")).toBe(true);
  });

  it("supports intra-segment wildcards", () => {
    expect(pathMatchesGlob("notes1.search", "notes?.*")).toBe(false); // '?' is literal
    expect(pathMatchesGlob("notes1.search", "notes*.*")).toBe(true);
  });

  it("escapes regex specials in literals", () => {
    expect(pathMatchesGlob("a+b.c", "a+b.c")).toBe(true);
    expect(pathMatchesGlob("ab.c", "a+b.c")).toBe(false);
  });
});

describe("pathMatchesGlobs", () => {
  it("matches if any pattern matches", () => {
    expect(pathMatchesGlobs("health.ping", ["notes.*", "health.**"])).toBe(true);
    expect(pathMatchesGlobs("admin.stats", ["notes.*", "health.**"])).toBe(false);
  });
});
