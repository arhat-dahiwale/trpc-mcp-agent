import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FEATURES,
  HERO_HEADLINE,
  INSPECTOR_COMMAND,
  INSTALL_COMMAND,
  MCP_SERVER_SNIPPET,
  PACKAGES,
  ROUTER_SNIPPET,
} from "./content";

const readme = readFileSync(fileURLToPath(new URL("../../README.md", import.meta.url)), "utf8");

const sourceOf = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("landing content", () => {
  it("renders the six advertised features", () => {
    expect(FEATURES).toHaveLength(6);
    for (const feature of FEATURES) {
      expect(feature.title.length).toBeGreaterThan(10);
      expect(feature.body.length).toBeGreaterThan(40);
    }
  });

  it("lists exactly the four published packages, matching the README", () => {
    expect(PACKAGES.map((p) => p.name)).toEqual([
      "@trpc-mcp/core",
      "@trpc-mcp/mcp",
      "@trpc-mcp/ai-sdk",
      "@trpc-mcp/otel",
    ]);
    for (const pkg of PACKAGES) {
      expect(readme).toContain(pkg.name);
    }
  });

  it("quickstart snippets are copied verbatim from the README", () => {
    expect(readme).toContain(ROUTER_SNIPPET);
    expect(readme).toContain(MCP_SERVER_SNIPPET);
    expect(readme).toContain(INSPECTOR_COMMAND);
    expect(readme).toContain(INSTALL_COMMAND);
  });

  it("hero copy matches the README positioning", () => {
    expect(readme).toContain("Expose your existing tRPC router");
    expect(HERO_HEADLINE).toContain("tRPC router");
    expect(HERO_HEADLINE).toContain("MCP server");
  });
});

describe("landing page structure", () => {
  const page = sourceOf("./app/page.tsx");
  const hero = sourceOf("./components/hero.tsx");
  const quickstart = sourceOf("./components/quickstart.tsx");
  const footer = sourceOf("./components/footer.tsx");
  const features = sourceOf("./components/features.tsx");
  const packagesTable = sourceOf("./components/packages-table.tsx");
  const pipeline = sourceOf("./components/pipeline.tsx");

  it("mounts all key sections in order", () => {
    const order = [
      ["<Hero />", hero],
      ["<Features />", features],
      ["<Pipeline />", pipeline],
      ["<Quickstart />", quickstart],
      ["<PackagesTable />", packagesTable],
      ["<Footer />", footer],
    ] as const;
    let cursor = -1;
    for (const [marker] of order) {
      const at = page.indexOf(marker);
      expect(at, `${marker} should appear on the page`).toBeGreaterThan(-1);
      expect(at, `${marker} should keep section order`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("anchors referenced by the nav exist as section ids", () => {
    const ids = ["features", "how", "quickstart", "packages", "top"];
    const all = [page, hero, features, pipeline, quickstart, packagesTable].join("\n");
    for (const id of ids) {
      expect(all).toContain(`id="${id}"`);
    }
  });

  it("hero renders the headline and both CTAs", () => {
    expect(hero).toContain("{HERO_HEADLINE}");
    expect(hero).toContain("#quickstart");
    expect(hero).toContain("GitHub");
  });

  it("quickstart section embeds the real snippets", () => {
    expect(quickstart).toContain("ROUTER_SNIPPET");
    expect(quickstart).toContain("MCP_SERVER_SNIPPET");
    expect(quickstart).toContain("INSPECTOR_COMMAND");
  });

  it("no lorem ipsum anywhere", () => {
    const all = sourceOf("./app/page.tsx") + sourceOf("./content.ts");
    expect(all.toLowerCase()).not.toContain("lorem");
    expect(all.toLowerCase()).not.toContain("ipsum");
    expect(all.toLowerCase()).not.toContain("placeholder");
  });
});
