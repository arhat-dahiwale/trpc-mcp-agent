import { INSTALL_COMMAND, PACKAGES } from "../content";
import { Reveal } from "./reveal";

export function PackagesTable() {
  return (
    <section id="packages" className="relative bg-cream text-ink">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <Reveal className="max-w-2xl">
          <p className="chip chip-on-light">Packages</p>
          <h2 className="mt-7 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Small packages, sharp edges kept out.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink/70">
            Pick the adapters you need. Core has zero runtime dependencies — tRPC, Zod, the MCP SDK,
            and <code className="font-mono text-[0.9em]">ai</code> stay peer dependencies you
            already control.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-14">
          <div className="glass-light overflow-hidden rounded-2xl">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="px-6 py-4 font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink/50">
                    Package
                  </th>
                  <th className="px-6 py-4 font-mono text-xs font-medium uppercase tracking-[0.16em] text-ink/50">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody>
                {PACKAGES.map((pkg) => (
                  <tr
                    key={pkg.name}
                    className="border-b border-ink/5 transition-colors last:border-b-0 hover:bg-brand/5"
                  >
                    <td className="whitespace-nowrap px-6 py-5 font-mono text-sm font-semibold text-brand">
                      {pkg.name}
                    </td>
                    <td className="px-6 py-5 text-[15px] leading-relaxed text-ink/80">
                      {pkg.purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="mt-8 font-mono text-sm text-ink/60">
            <span className="text-brand">$</span> {INSTALL_COMMAND}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
