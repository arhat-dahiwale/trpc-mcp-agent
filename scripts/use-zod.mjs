#!/usr/bin/env node
// Switches the workspace between Zod 3 and Zod 4 for the CI test matrix.
//
// Usage: node scripts/use-zod.mjs <3|4>
//
// It writes a pnpm.overrides.zod entry into the root package.json and runs
// `pnpm install` so every workspace package resolves the requested Zod line.
// CI restores package.json/pnpm-lock.yaml afterwards (`git checkout --`).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const target = process.argv[2];
if (target !== "3" && target !== "4") {
  console.error("usage: node scripts/use-zod.mjs <3|4>");
  process.exit(1);
}

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(require.resolve("../package.json")), "..");

const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const versions = {
  3: "^3.25.0",
  4: "^4.0.0",
};

pkg.pnpm = {
  ...(pkg.pnpm ?? {}),
  overrides: { ...(pkg.pnpm?.overrides ?? {}), zod: versions[target] },
};

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
execFileSync("pnpm", ["install", "--no-frozen-lockfile"], {
  stdio: "inherit",
  cwd: rootDir,
  shell: process.platform === "win32",
});
console.log(`[use-zod] workspace now resolves zod ${versions[target]}`);
