import { FEATURES } from "../content";
import { FeatureIcon } from "./icons";
import { Reveal } from "./reveal";

export function Features() {
  return (
    <section id="features" className="relative bg-cream text-ink">
      {/* Soft red/cream glows give the glass cards something to refract. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-24 h-96 w-96 rounded-full bg-brand/15 blur-3xl" />
        <div className="absolute -right-28 top-1/2 h-80 w-80 rounded-full bg-brand-bright/10 blur-3xl" />
        <div className="absolute bottom-16 left-1/3 h-72 w-72 rounded-full bg-cream-dim/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <Reveal className="max-w-2xl">
          <p className="chip chip-on-light">Why trpc-mcp</p>
          <h2 className="mt-7 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Everything agents need. Nothing you don&rsquo;t already have.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink/70">
            Your tRPC router already has schemas, auth, and permissions. trpc-mcp adapts it to MCP
            and the Vercel AI SDK instead of making you rebuild any of it.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 0.08} className="h-full">
              <article className="glass-light group h-full rounded-2xl p-7 transition-transform duration-300 hover:-translate-y-1">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                  <FeatureIcon name={feature.icon} />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{feature.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
