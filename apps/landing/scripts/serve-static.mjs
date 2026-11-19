// Minimal static file server for verifying the exported site locally.
// Run: node scripts/serve-static.mjs [port]   (default 4173)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.argv[2] ?? "") || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    // Resolve inside root only; strip leading slashes and any traversal.
    const relative = normalize(pathname).replace(/^([/\\]|\.\.)+/, "");
    const file = join(root, relative);
    if (!file.startsWith(root + sep) && file !== root) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.error(`serving ${root} at http://127.0.0.1:${port}`);
});
