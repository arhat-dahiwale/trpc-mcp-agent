/**
 * Converts Zod input/output parsers to JSON Schema, handling both Zod v3 and v4.
 *
 * Verified against zod@4.6.7 and zod-to-json-schema@3.25.2:
 * - Zod v4 schemas carry an internal `_zod` property; v3 schemas do not
 *   (but v4 schemas ALSO have `_def` for backcompat, so check `_zod` first).
 * - `z.toJSONSchema(schema, { io })` ships with zod v4 (and the 3.25 bridge)
 *   and emits JSON Schema 2020-12.
 * - `zod-to-json-schema` (CJS-only) converts v3 schemas; target draft-2020-12
 *   is supported so both majors emit the same dialect.
 *
 * The v3 converter is an optional peer: it is required lazily and only when a
 * v3 schema actually needs converting, so zod-v4-only consumers never need it.
 */

import * as zodNamespace from "zod";
import type { JsonSchema } from "./types.js";

export interface SchemaConversionOptions {
  /** Force a Zod major instead of auto-detection. */
  zodMajor?: 3 | 4;
  /**
   * Which direction the schema describes. Zod v4 renders defaults and other
   * bidirectional concepts differently for input vs output. Defaults to
   * "input" (tool inputs describe what callers may send).
   */
  io?: "input" | "output";
}

/** Zod v4 schemas expose `_zod`. Zod v3 schemas expose `_def` only. */
export function isZodV4Schema(schema: unknown): boolean {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "_zod" in schema &&
    typeof (schema as { _zod: unknown })._zod === "object"
  );
}

function asObjectSchema(input: unknown, source: string): JsonSchema {
  if (typeof input !== "object" || input === null) {
    throw new Error(`Schema conversion for ${source} did not produce a JSON Schema object.`);
  }
  const schema = input as JsonSchema;
  // Every tool input is an object schema at the protocol level.
  const out: JsonSchema = { ...schema, type: "object" };
  if (out.properties === undefined) out.properties = {};
  return out;
}

// ---------------------------------------------------------------------------
// Zod v4
// ---------------------------------------------------------------------------

interface ZodV4Namespace {
  toJSONSchema?: (
    schema: unknown,
    params?: { io?: "input" | "output"; target?: string },
  ) => unknown;
}

function convertV4(schema: unknown, io: "input" | "output"): JsonSchema {
  const toJSONSchema = (zodNamespace as unknown as ZodV4Namespace).toJSONSchema;
  if (typeof toJSONSchema !== "function") {
    throw new Error(
      'A Zod v4 schema was encountered, but the "zod" module resolved by @trpc-mcp/core does not provide toJSONSchema. Install zod@>=3.25 (bridge) or zod@4, or provide registry option `convertSchema`.',
    );
  }
  return asObjectSchema(toJSONSchema(schema, { io }), "a zod v4 schema");
}

// ---------------------------------------------------------------------------
// Zod v3
// ---------------------------------------------------------------------------

type ZodToJsonSchemaFn = (schema: unknown, opts?: Record<string, unknown>) => unknown;

function getCreateRequire(): ((base: string) => NodeRequire) | undefined {
  const proc = (
    globalThis as {
      process?: {
        getBuiltinModule?: (id: string) => unknown;
        cwd?: () => string;
      };
    }
  ).process;
  if (typeof proc?.getBuiltinModule !== "function") return undefined;
  try {
    const mod = proc.getBuiltinModule("module") as
      { createRequire?: (base: string) => NodeRequire } | undefined;
    return typeof mod?.createRequire === "function" ? mod.createRequire : undefined;
  } catch {
    return undefined;
  }
}

let cachedV3Converter: ZodToJsonSchemaFn | undefined;
let v3ConverterLookupDone = false;

function findV3Converter(): ZodToJsonSchemaFn | undefined {
  const createRequire = getCreateRequire();
  if (!createRequire) return undefined;

  let requireFn: NodeRequire | undefined;
  try {
    // ESM builds: resolve relative to dist/index.js so peer resolution inside
    // the package's own node_modules context applies.
    const url = (import.meta as { url?: string }).url;
    if (typeof url === "string" && url.startsWith("file:")) {
      requireFn = createRequire(url);
    }
  } catch {
    requireFn = undefined;
  }
  if (!requireFn) {
    try {
      // CJS builds (import.meta rewritten away) and file://-less hosts.
      requireFn = createRequire(process.cwd() + "/");
    } catch {
      return undefined;
    }
  }

  try {
    const mod = requireFn("zod-to-json-schema") as
      { zodToJsonSchema?: ZodToJsonSchemaFn } | ZodToJsonSchemaFn;
    const fn =
      typeof mod === "function"
        ? mod
        : typeof mod?.zodToJsonSchema === "function"
          ? mod.zodToJsonSchema
          : undefined;
    return fn ?? undefined;
  } catch {
    return undefined;
  }
}

function loadV3Converter(): ZodToJsonSchemaFn | undefined {
  if (!v3ConverterLookupDone) {
    v3ConverterLookupDone = true;
    cachedV3Converter = findV3Converter();
  }
  return cachedV3Converter;
}

function convertV3(schema: unknown): JsonSchema {
  const convert = loadV3Converter();
  if (!convert) {
    throw new Error(
      'Converting Zod v3 schemas requires the optional peer dependency "zod-to-json-schema". Install it, or provide registry option `convertSchema` to convert parsers yourself.',
    );
  }
  return asObjectSchema(convert(schema, { target: "draft-2020-12" }), "a zod v3 schema");
}

/**
 * Convert a Zod parser (v3 or v4) into a JSON Schema object schema.
 * Non-Zod parsers are rejected; use the registry's `convertSchema` option
 * to support other parser libraries.
 */
export function zodToJsonSchema(schema: unknown, options?: SchemaConversionOptions): JsonSchema {
  const io = options?.io ?? "input";
  const major = options?.zodMajor ?? (isZodV4Schema(schema) ? 4 : 3);
  return major === 4 ? convertV4(schema, io) : convertV3(schema);
}
