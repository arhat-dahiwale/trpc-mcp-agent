import { PIPELINE } from "../content";
import { Reveal } from "./reveal";

export function Pipeline() {
  return (
    <section id="how" className="relative bg-cream pb-24 text-ink md:pb-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="chip chip-on-light">How it works</p>
          <h2 className="mt-7 font-display text-4xl font-bold tracking-tight md:text-5xl">
            One registry. Every protocol.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink/70">
            trpc-mcp introspects your router once and adapts it to MCP and the AI SDK. Every call
            executes through <code className="font-mono text-[0.9em] text-brand">createCaller</code>{" "}
            — your middleware remains the only permission system.
          </p>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="mt-14 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {PIPELINE.map((node, i) => {
              const isYours = node.title === "your tRPC router";
              const isCore = node.title === "@trpc-mcp/core";
              return (
                <div key={node.title} className="contents">
                  <div
                    className={`flex flex-col justify-center rounded-2xl px-6 py-5 ${
                      isYours ? "border-2 border-brand bg-brand/5" : "glass-light"
                    }`}
                  >
                    <p
                      className={`font-mono text-sm font-semibold ${
                        isCore || isYours ? "text-brand" : "text-ink"
                      }`}
                    >
                      {node.title}
                    </p>
                    <p className="mt-1.5 text-sm text-ink/60">{node.sub}</p>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="grid place-items-center py-1 text-brand md:py-0"
                    >
                      <span className="hidden text-xl md:block">→</span>
                      <span className="rotate-90 text-xl md:hidden">→</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-10 font-mono text-sm text-ink/60">
            createCaller · policy(ctx, tool) · Zod → JSON Schema · progress · cancellation
          </p>
        </Reveal>
      </div>
    </section>
  );
}
