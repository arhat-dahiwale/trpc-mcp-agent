import type { AnyRouter } from "@trpc/server";
import { deriveAnnotations } from "./annotations.js";
import { sanitizeError, ToolAbort, ToolRegistryError } from "./errors.js";
import { pathMatchesGlobs } from "./glob.js";
import { introspectRouter } from "./introspect.js";
import { assertNoNameCollisions, assertValidToolName, defaultNameStrategy } from "./naming.js";
import { zodToJsonSchema } from "./zod-adapter.js";
import type {
  CallOptions,
  JsonSchema,
  McpProgressEvent,
  McpToolContext,
  ProcedureType,
  RegistryOptions,
  ToolCallResult,
  ToolDefinition,
  ToolInfo,
} from "./types.js";

interface RegistryEntry {
  def: ToolDefinition;
  /** Original input parser instances, for reference/debugging. */
  inputs: unknown[];
  output: unknown;
}

export interface ToolRegistry<TRouter = unknown, Ctx = unknown> {
  /**
   * All exposed definitions after include/exclude, ignoring policy.
   * Intended for docs, startup logs, and tests — NOT for access control.
   */
  definitions(): ToolDefinition[];
  /** Definitions visible to this context after policy. */
  list(ctx: Ctx): Promise<ToolDefinition[]>;
  /**
   * Invoke a tool by name. Denied and unknown tools return the identical
   * NOT_FOUND error. Never throws; failures come back as sanitized results.
   */
  call(name: string, input: unknown, ctx: Ctx, opts?: CallOptions): Promise<ToolCallResult>;
  /** The router the registry was built from. */
  readonly router: TRouter;
}

/**
 * Build a tool registry from a tRPC router.
 *
 * Only procedures with `meta.mcp.expose === true` become tools. Name
 * collisions and unusable schemas fail fast here, at startup.
 */
export function createToolRegistry<TRouter extends AnyRouter, Ctx>(
  options: RegistryOptions<TRouter, Ctx>,
): ToolRegistry<TRouter, Ctx> {
  const nameStrategy = options.nameStrategy ?? defaultNameStrategy;
  const router = options.router as unknown as Parameters<typeof introspectRouter>[0];

  const entryList: RegistryEntry[] = [];

  for (const proc of introspectRouter(router)) {
    if (proc.type === "subscription") continue; // subscriptions are out of scope (PRD non-goal)
    const mcpMeta = proc.meta?.mcp;
    if (mcpMeta?.expose !== true) continue;

    const path = proc.path;
    if (!passesPathFilters(path, options.include, options.exclude)) continue;

    const name = assertValidToolName(mcpMeta.name ?? nameStrategy(path), path);
    const type = proc.type as ProcedureType;
    const annotations = deriveAnnotations(type, mcpMeta.annotations);

    let inputSchema: JsonSchema;
    try {
      inputSchema =
        proc.inputs.length === 0
          ? { type: "object", properties: {} }
          : convertInput(proc.inputs, options.convertSchema);
    } catch (err) {
      throw new ToolRegistryError(
        `Cannot build JSON Schema for "${path}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    let outputSchema: JsonSchema | undefined;
    if (proc.output !== undefined && proc.output !== null) {
      try {
        outputSchema = convertOne(proc.output, options.convertSchema, "output");
      } catch (err) {
        throw new ToolRegistryError(
          `Cannot build output JSON Schema for "${path}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const def: ToolDefinition = {
      name,
      path,
      type,
      ...(mcpMeta.title !== undefined ? { title: mcpMeta.title } : {}),
      description: mcpMeta.description ?? "",
      inputSchema,
      ...(outputSchema !== undefined ? { outputSchema } : {}),
      annotations,
      tags: [...(mcpMeta.tags ?? [])],
      longRunning: mcpMeta.longRunning === true,
      ...(mcpMeta.timeoutMs !== undefined ? { timeoutMs: mcpMeta.timeoutMs } : {}),
    };

    entryList.push({ def, inputs: proc.inputs, output: proc.output });
  }

  assertNoNameCollisions(entryList.map((e) => ({ name: e.def.name, path: e.def.path })));

  // After collision detection the name space is proven unique.
  const entries = new Map(entryList.map((e) => [e.def.name, e]));

  const errorFormatter = options.errorFormatter ?? ((err: unknown) => sanitizeError(err));

  const policy = options.policy;

  async function checkPolicy(ctx: Ctx, info: ToolInfo): Promise<boolean> {
    if (!policy) return true;
    try {
      return await policy(ctx, info);
    } catch {
      // A broken policy must never widen visibility: fail closed.
      return false;
    }
  }

  // Denied and unknown tools return the byte-identical error: the caller
  // already knows what name it asked for, and echoing it back would let
  // nothing distinguish existence from policy denial.
  const notFound = (durationMs: number): ToolCallResult => ({
    ok: false,
    error: { code: "NOT_FOUND", message: "Tool not found." },
    durationMs,
  });

  return {
    router: options.router,
    definitions() {
      return [...entries.values()].map((e) => e.def);
    },

    async list(ctx: Ctx): Promise<ToolDefinition[]> {
      const visible: ToolDefinition[] = [];
      for (const entry of entries.values()) {
        if (await checkPolicy(ctx, toInfo(entry.def))) {
          visible.push(entry.def);
        }
      }
      return visible;
    },

    async call(
      name: string,
      input: unknown,
      ctx: Ctx,
      opts?: CallOptions,
    ): Promise<ToolCallResult> {
      const startedAt = Date.now();
      const entry = entries.get(name);
      if (entry === undefined) {
        return notFound(Date.now() - startedAt);
      }
      // List filtering is not security: re-check policy on every call.
      if (!(await checkPolicy(ctx, toInfo(entry.def)))) {
        return notFound(Date.now() - startedAt);
      }

      const controller = new AbortController();
      const cleanupFns: Array<() => void> = [];
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let abortReason: "cancelled" | "timeout" = "cancelled";
      const timeoutMs = entry.def.timeoutMs;

      const abort = (reason: "cancelled" | "timeout") => {
        if (controller.signal.aborted) return;
        abortReason = reason;
        controller.abort();
      };

      if (opts?.signal !== undefined) {
        if (opts.signal.aborted) {
          abort("cancelled");
        } else {
          const onAbort = () => abort("cancelled");
          opts.signal.addEventListener("abort", onAbort, { once: true });
          cleanupFns.push(() => opts.signal?.removeEventListener("abort", onAbort));
        }
      }

      if (timeoutMs !== undefined) {
        timeoutId = setTimeout(() => abort("timeout"), timeoutMs);
        cleanupFns.push(() => {
          if (timeoutId !== undefined) clearTimeout(timeoutId);
        });
      }

      const mcpCtx: McpToolContext = {
        progress: (value: number, total?: number, message?: string) => {
          const event: McpProgressEvent = { progress: value };
          if (total !== undefined) event.total = total;
          if (message !== undefined) event.message = message;
          try {
            opts?.onProgress?.(event);
          } catch {
            // A throwing progress sink must not break the tool call.
          }
        },
        signal: controller.signal,
      };

      const caller = createCallerForRouter(options.router, {
        ...(ctx as object),
        mcp: mcpCtx,
      });

      try {
        const result = await invokeProcedure(
          caller,
          entry.def.path,
          entry.inputs.length === 0 ? undefined : input,
          controller.signal,
          () => abortReason,
          timeoutMs,
        );
        return {
          ok: true,
          data: result,
          durationMs: Date.now() - startedAt,
        };
      } catch (err) {
        const { code, message } = errorFormatter(err);
        return {
          ok: false,
          error: { code, message },
          durationMs: Date.now() - startedAt,
        };
      } finally {
        for (const cleanup of cleanupFns) cleanup();
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function toInfo(def: ToolDefinition): ToolInfo {
  return { name: def.name, path: def.path, type: def.type, tags: def.tags };
}

function passesPathFilters(
  path: string,
  include: readonly string[] | undefined,
  exclude: readonly string[] | undefined,
): boolean {
  if (include !== undefined && include.length > 0 && !pathMatchesGlobs(path, include)) {
    return false;
  }
  if (exclude !== undefined && exclude.length > 0 && pathMatchesGlobs(path, exclude)) {
    return false;
  }
  return true;
}

/** Multiple `.input()` calls merge; the JSON Schema must describe their union shape. */
function convertInput(
  inputs: unknown[],
  convertSchema: ((parser: unknown) => JsonSchema) | undefined,
): JsonSchema {
  const schemas = inputs.map((parser) => convertOne(parser, convertSchema, "input"));
  if (schemas.length === 1) return schemas[0] as JsonSchema;
  // Merge object schemas conservatively: intersect properties and required.
  const merged: JsonSchema = { type: "object", properties: {} };
  const required = new Set<string>();
  for (const schema of schemas) {
    merged.properties = { ...merged.properties, ...(schema.properties ?? {}) };
    for (const key of schema.required ?? []) required.add(key);
    if (schema.additionalProperties === false) merged.additionalProperties = false;
  }
  merged.required = [...required].sort();
  return merged;
}

/** Convert a parser, choosing the conversion direction from its role. */
function convertOne(
  parser: unknown,
  convertSchema: ((parser: unknown) => JsonSchema) | undefined,
  role: "input" | "output",
): JsonSchema {
  if (convertSchema) return convertSchema(parser);
  return zodToJsonSchema(parser, { io: role });
}

/**
 * Resolve a caller for the router with the tool context merged into ctx.
 * `t.createCallerFactory` is preferred over `router.createCaller` (v11 docs);
 * both accept the same context.
 */
function createCallerForRouter<TRouter extends AnyRouter, Ctx>(router: TRouter, ctx: Ctx): unknown {
  const factory = (
    router as unknown as {
      createCaller: (ctx: Ctx) => unknown;
    }
  ).createCaller;
  if (typeof factory !== "function") {
    throw new ToolRegistryError("Cannot create a caller from the router. Is it a tRPC v11 router?");
  }
  return factory.call(router as unknown as object, ctx);
}

/**
 * Invoke a procedure path on a tRPC caller, racing it against the combined
 * abort signal so cancellation and timeouts return even when the procedure
 * ignores `ctx.mcp.signal`.
 */
async function invokeProcedure(
  caller: unknown,
  path: string,
  input: unknown,
  signal: AbortSignal,
  abortReason: () => "cancelled" | "timeout",
  timeoutMs: number | undefined,
): Promise<unknown> {
  const procedureFn = resolveProcedurePath(caller, path);
  if (typeof procedureFn !== "function") {
    throw new ToolAbort("INTERNAL", `Procedure "${path}" is not invocable.`);
  }

  const invocation = Promise.resolve(
    input === undefined ? procedureFn.call(caller) : procedureFn.call(caller, input),
  );
  // The losing promise must not become an unhandled rejection.
  invocation.catch(() => undefined);

  if (signal.aborted) {
    throw abortReason() === "timeout"
      ? new ToolAbort(
          "TIMEOUT",
          `Tool call timed out${timeoutMs !== undefined ? ` after ${timeoutMs} ms` : ""}.`,
        )
      : new ToolAbort("CANCELLED", "Tool call was cancelled.");
  }

  const aborted = new Promise<never>((_, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        reject(
          abortReason() === "timeout"
            ? new ToolAbort(
                "TIMEOUT",
                `Tool call timed out${timeoutMs !== undefined ? ` after ${timeoutMs} ms` : ""}.`,
              )
            : new ToolAbort("CANCELLED", "Tool call was cancelled."),
        );
      },
      { once: true },
    );
  });
  aborted.catch(() => undefined);
  return await Promise.race([invocation, aborted]);
}

function resolveProcedurePath(caller: unknown, path: string): unknown {
  let current: unknown = caller;
  for (const segment of path.split(".")) {
    // The caller is a recursive proxy (a function), so accept functions here.
    if ((typeof current !== "object" && typeof current !== "function") || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
