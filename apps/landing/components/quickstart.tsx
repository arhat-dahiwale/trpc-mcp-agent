import { INSPECTOR_COMMAND, INSTALL_COMMAND, MCP_SERVER_SNIPPET, ROUTER_SNIPPET } from "../content";
import { CodeBlock } from "./code-block";
import { Reveal } from "./reveal";

export function Quickstart() {
  return (
    <section id="quickstart" className="relative overflow-hidden bg-ink text-cream">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-72 w-[62rem] max-w-none -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-brand-deep/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <Reveal className="max-w-2xl">
          <p className="chip">Live quickstart</p>
          <h2 className="mt-7 font-display text-4xl font-bold tracking-tight md:text-5xl">
            From router to server in three files.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-cream/70">
            This is the actual quickstart from the README — the exact same code is kept compiling
            and tested in{" "}
            <a
              href="https://github.com/arhat-dahiwale/trpc-mcp-agent/tree/main/examples/quickstart"
              target="_blank"
              rel="noreferrer"
              className="text-brand-bright underline decoration-brand/50 underline-offset-4 hover:decoration-brand-bright"
            >
              examples/quickstart
            </a>
            , so these snippets can never drift from the docs.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6">
          <Reveal delay={0.05}>
            <CodeBlock code={INSTALL_COMMAND} lang="bash" label="01 · install" />
          </Reveal>

          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <Reveal delay={0.1} className="min-w-0">
              <CodeBlock code={ROUTER_SNIPPET} lang="ts" label="02 · router.ts" />
            </Reveal>
            <Reveal delay={0.15} className="min-w-0">
              <CodeBlock code={MCP_SERVER_SNIPPET} lang="ts" label="03 · mcp-server.ts" />
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <CodeBlock code={INSPECTOR_COMMAND} lang="bash" label="04 · try it" />
          </Reveal>

          <Reveal delay={0.25}>
            <p className="mt-2 text-sm leading-relaxed text-cream/60">
              Any MCP client works — Claude Desktop, Cursor, or the Inspector above. Prefer HTTP?
              The same registry is served by{" "}
              <code className="font-mono text-[0.9em] text-cream/90">createHttpHandler()</code> on
              Hono, Express, Next.js, Bun, or Deno. Prefer agents?{" "}
              <code className="font-mono text-[0.9em] text-cream/90">toAiSdkTools()</code> hands it
              to the Vercel AI SDK.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
