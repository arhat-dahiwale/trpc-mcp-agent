/**
 * The single module allowed to access tRPC router/procedure internals
 * (`_def`). If tRPC changes its internal shape, only this file breaks.
 *
 * Verified against @trpc/server 11.23.0:
 * - `router._def.procedures` is a flat `Record<string, AnyProcedure>` keyed
 *   by the full dotted path ("user.get").
 * - `procedure._def.type` is "query" | "mutation" | "subscription".
 * - `procedure._def.inputs` is an array of input parsers (possibly empty).
 * - `procedure._def.output` is the output parser or undefined.
 * - `procedure._def.meta` is the merged meta object or undefined.
 */

import type { AnyRouter } from "@trpc/server";
import type { McpMeta, ProcedureType } from "./types.js";

/** Shape of a procedure as seen by the rest of the library. */
export interface IntrospectedProcedure {
  path: string;
  type: ProcedureType | "subscription";
  /** Opaque input parser instances (Zod or otherwise). Empty for no-input procedures. */
  inputs: unknown[];
  /** Opaque output parser instance when `.output()` was used. */
  output?: unknown;
  meta: McpMeta | undefined;
}

interface RawProcedureDef {
  type?: unknown;
  inputs?: unknown;
  output?: unknown;
  meta?: unknown;
}

interface RawProcedure {
  _def?: RawProcedureDef;
}

function readProcedureDef(procedure: unknown): RawProcedureDef {
  // tRPC v11 procedures are async functions with `_def` (and `meta`) attached
  // as own properties, so accept functions as well as objects here.
  if (
    (typeof procedure !== "object" && typeof procedure !== "function") ||
    procedure === null ||
    !("_def" in procedure) ||
    typeof (procedure as RawProcedure)._def !== "object" ||
    (procedure as RawProcedure)._def === null
  ) {
    throw new Error(
      "Cannot read tRPC procedure internals. This usually means the object passed to the registry is not a tRPC router, or an incompatible @trpc/server version is installed.",
    );
  }
  return (procedure as RawProcedure)._def as RawProcedureDef;
}

/** All procedure paths on a router (flat, dotted). */
export function listProcedurePaths(router: unknown): string[] {
  if (typeof router !== "object" || router === null || !("_def" in router)) {
    throw new Error(
      "Cannot read tRPC router internals. This usually means the object passed to the registry is not a tRPC router, or an incompatible @trpc/server version is installed.",
    );
  }
  const def = (router as { _def: { procedures?: Record<string, unknown> } })._def;
  if (typeof def.procedures !== "object" || def.procedures === null) {
    throw new Error("tRPC router internals have changed: `_def.procedures` is missing.");
  }
  return Object.keys(def.procedures);
}

/** Read one procedure by its full dotted path. */
export function readProcedure(router: unknown, path: string): IntrospectedProcedure | undefined {
  if (typeof router !== "object" || router === null || !("_def" in router)) {
    throw new Error("Cannot read tRPC router internals.");
  }
  const procedures = (router as { _def: { procedures?: Record<string, unknown> } })._def.procedures;
  if (typeof procedures !== "object" || procedures === null) return undefined;
  const procedure = procedures[path];
  if (procedure === undefined) return undefined;

  const def = readProcedureDef(procedure);
  const type =
    def.type === "query" || def.type === "mutation" || def.type === "subscription"
      ? def.type
      : undefined;
  if (type === undefined) {
    throw new Error(
      `tRPC procedure internals have changed: unexpected procedure type at "${path}".`,
    );
  }
  const inputs = Array.isArray(def.inputs) ? [...def.inputs] : [];
  return {
    path,
    type,
    inputs,
    output: def.output,
    meta: (def.meta ?? undefined) as McpMeta | undefined,
  };
}

/** Typed convenience: all procedures of a router, in deterministic path order. */
export function introspectRouter(router: AnyRouter): IntrospectedProcedure[] {
  return listProcedurePaths(router)
    .sort()
    .map((path) => readProcedure(router, path))
    .filter((p): p is IntrospectedProcedure => p !== undefined);
}
