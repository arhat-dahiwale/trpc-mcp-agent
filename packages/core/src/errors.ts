import { TRPCError } from "@trpc/server";
import type { ToolErrorCode } from "./types.js";

/** Thrown at registry creation for configuration problems (name collisions, bad options). */
export class ToolRegistryError extends Error {
  override readonly name = "ToolRegistryError";
  constructor(message: string) {
    super(message);
  }
}

/**
 * Error thrown by registry internals when a call cannot proceed.
 * The registry converts these into sanitized `ToolCallResult`s; it never
 * lets one escape to a transport.
 */
export class ToolAbort extends Error {
  readonly code: ToolErrorCode;
  constructor(code: ToolErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ToolAbort";
  }
}

/** tRPC error codes that are safe to surface verbatim (developer-authored, user-facing). */
const SAFE_TRPC_CODES = new Set([
  "BAD_REQUEST",
  "PARSE",
  "UNPROCESSABLE_CONTENT",
  "PAYLOAD_TOO_LARGE",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "TIMEOUT",
  "CLIENT_CLOSED_REQUEST",
]);

const GENERIC_INTERNAL_MESSAGE = "Internal error while executing the tool.";

/** tRPC code -> sanitized tool error code. */
function trpcCodeToToolCode(code: string): ToolErrorCode {
  switch (code) {
    case "BAD_REQUEST":
    case "PARSE":
    case "UNPROCESSABLE_CONTENT":
    case "PAYLOAD_TOO_LARGE":
      return "BAD_REQUEST";
    case "UNAUTHORIZED":
      return "UNAUTHORIZED";
    case "FORBIDDEN":
      return "FORBIDDEN";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "TIMEOUT":
      return "TIMEOUT";
    case "CLIENT_CLOSED_REQUEST":
      return "CANCELLED";
    default:
      // METHOD_NOT_SUPPORTED, CONFLICT, PRECONDITION_FAILED, TOO_MANY_REQUESTS,
      // SERVICE_UNAVAILABLE, INTERNAL_SERVER_ERROR and anything unknown.
      return "INTERNAL";
  }
}

/**
 * Default sanitizer: map a thrown error to a `{ code, message }` pair that is
 * safe to hand to an agent. Never includes stacks, causes, or context.
 *
 * - TRPCError codes that developers throw intentionally keep their message
 *   (they are user-facing by design: validation, authz, not-found).
 * - Everything else becomes a generic INTERNAL error.
 */
export function sanitizeError(err: unknown): {
  code: ToolErrorCode;
  message: string;
} {
  if (err instanceof TRPCError && SAFE_TRPC_CODES.has(err.code)) {
    return { code: trpcCodeToToolCode(err.code), message: err.message };
  }
  if (err instanceof ToolAbort) {
    return { code: err.code, message: err.message };
  }
  return { code: "INTERNAL", message: GENERIC_INTERNAL_MESSAGE };
}
