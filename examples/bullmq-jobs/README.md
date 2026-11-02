# bullmq-jobs

Long-running tRPC tools backed by BullMQ + Redis, with live progress over the
`ctx.mcp.progress` contract.

## Run

```bash
docker run -d --rm --name trpc-mcp-redis -p 6399:6379 redis:8-alpine
REDIS_URL=redis://127.0.0.1:6399 npx @modelcontextprotocol/inspector tsx server.ts
```

Call `reports_generate` in the Inspector and watch progress notifications
arrive live; cancel the call and the wait stops (the job keeps running).

## How it works

```
tools/call (progressToken) ─► procedure enqueues BullMQ job
                                    │
Worker ─► job.updateProgress ─► Redis
                                    │
procedure polls ─► ctx.mcp.progress ─► notifications/progress
```

- The contract (`ctx.mcp.progress`, `ctx.mcp.signal`) is BullMQ-independent;
  swap the queue without touching transports.
- `meta.mcp.timeoutMs` bounds the poll loop; the client can cancel anytime.
- Without Redis the tests skip themselves, so CI stays green.
