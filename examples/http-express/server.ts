/**
 * Express example: mount the fetch-style MCP handler at POST /mcp.
 *
 * Express 5 speaks Node req/res, so this example includes a small adapter:
 * Node req/res -> Web Standard Request -> handler -> Web Standard Response
 * -> Node res. The adapter is illustrative and kept in this file.
 *
 * Run with: pnpm --filter @trpc-mcp/examples-http-express start
 */

import express from "express";
import type { Express } from "express";
import { Readable } from "node:stream";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import type { McpMeta } from "@trpc-mcp/core";
import { createHttpHandler } from "@trpc-mcp/mcp";

interface ApiContext {
  userId: string | null;
}

const t = initTRPC.context<ApiContext>().meta<McpMeta>().create();

const requireUser = t.middleware(({ ctx, next }) => {
  if (ctx.userId === null) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Provide a valid bearer token." });
  }
  return next();
});

const appRouter = t.router({
  greet: t.procedure
    .meta({ mcp: { expose: true, description: "Greet a user by name" } })
    .input(z.object({ name: z.string() }))
    .query(({ input }) => `Hello, ${input.name}!`),

  addTask: t.procedure
    .use(requireUser)
    .meta({ mcp: { expose: true, description: "Add a task (auth required)" } })
    .input(z.object({ title: z.string() }))
    .mutation(({ input, ctx }) => ({ added: input.title, by: ctx.userId })),
});

const mcpHandler = createHttpHandler({
  router: appRouter,
  name: "express-demo",
  version: "0.1.0",
  createContext: async (info) => {
    if (info.transport !== "http") return { userId: null };
    const auth = info.request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return token === "demo-token" ? { userId: "u-express" } : { userId: null };
  },
});

/** Node req/res -> fetch Request. */
function toFetchRequest(req: import("express").Request, protocol = "http"): Request {
  const url = `${protocol}://${req.headers.host ?? "localhost"}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return new Request(url, {
    method: req.method,
    headers,
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : (Readable.toWeb(req) as unknown as ReadableStream),
    duplex: "half",
  });
}

/** fetch Response -> Node res (streamed). */
async function sendResponse(response: Response, res: import("express").Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (response.body === null) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

// Annotation required: express's inferred type is not portable across
// @types/express-serve-static-core hoisting boundaries.
const app: Express = express();

// All MCP methods (POST for JSON-RPC; GET/DELETE answered 405 by the
// handler itself - stateless mode has no session) flow through the adapter.
app.all("/mcp", (req, res) => {
  void (async () => {
    try {
      const request = toFetchRequest(req);
      const response = await mcpHandler(request);
      await sendResponse(response, res);
    } catch (err: unknown) {
      // Server-side diagnostics only; the response body never carries them.
      console.warn("[express-demo] mcp handler failed:", err);
      res.status(500).end();
    }
  })();
});

export { app };

if (process.env.RUN_SERVER === "1") {
  app.listen(3032);
  console.warn("express demo listening on :3032");
}
