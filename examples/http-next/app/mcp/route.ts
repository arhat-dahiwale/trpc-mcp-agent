/**
 * Next.js App Router route handler: `app/mcp/route.ts` maps to POST/GET/DELETE
 * /mcp. Next route handlers receive a Web Standard Request and return a
 * Response, so the fetch-style handler drops in directly.
 */

import { mcpHandler } from "../../router";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return mcpHandler(request);
}

export async function GET(request: Request): Promise<Response> {
  return mcpHandler(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return mcpHandler(request);
}
