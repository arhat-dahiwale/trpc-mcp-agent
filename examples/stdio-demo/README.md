# stdio-demo

Runnable example exposing a small tRPC router as an MCP server over stdio.

## Try it with the MCP Inspector

```bash
pnpm install
npx @modelcontextprotocol/inspector tsx server.ts
```

In the Inspector UI, connect, then list tools and call `greeting`,
`createTask` (needs auth - see below), and `health`.

## Auth

The demo's context factory reads `MCP_USER_ID` from the environment:

```bash
MCP_USER_ID=demo-user npx @modelcontextprotocol/inspector tsx server.ts
```

`createTask` middleware throws `UNAUTHORIZED` without it - exactly the same
middleware a human-facing tRPC client would hit.

## What it demonstrates

- `serveStdio()` in ~5 lines
- opt-in exposure (`internal` is hidden from agents)
- annotations derived from procedure type (query -> readOnly, mutation -> not)
- middleware + validation reused from tRPC
