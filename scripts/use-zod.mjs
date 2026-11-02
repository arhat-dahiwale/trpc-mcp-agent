#!/usr/bin/env node
// Switches the workspace between Zod 3 and Zod 4 for the CI test matrix.
//
// Usage: node scripts/use-zod.mjs <3|4>
//
// It writes an `overrides.zod` entry into pnpm-workspace.yaml and runs
// `pnpm install` so every workspace package resolves the requested Zod line.
// CI restores pnpm-workspace.yaml/pnpm-lock.yaml afterwards (`git checkout --`).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const target = process.argv[2];
if (target !== "3" && target !== "4") {
  console.error("usage: node scripts/use-zod.mjs <3|4>");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspacePath = path.join(rootDir, "pnpm-workspace.yaml");

const versions = {
  3: "^3.25.0",
  4: "^4.0.0",
};

let yaml = readFileSync(workspacePath, "utf8");
// Replace or append the overrides block (only the zod key is managed here).
if (/^overrides:\n(\s+.*\n)*/m.test(yaml)) {
  yaml = yaml.replace(/^overrides:\n(\s+zod:.*\n)?/m, `overrides:\n  zod: ${versions[target]}\n`);
} else {
  yaml += `\noverrides:\n  zod: ${versions[target]}\n`;
}
writeFileSync(workspacePath, yaml);

execFileSync("pnpm", ["install", "--no-frozen-lockfile"], {
  stdio: "inherit",
  cwd: rootDir,
  shell: process.platform === "win32",
});
console.log(`[use-zod] workspace now resolves zod ${versions[target]}`);
