import { GITHUB_BLOB_URL, GITHUB_URL } from "../content";
import { GithubIcon } from "./icons";
import { LogoMark } from "./logo-mark";

const DOCS = [
  { label: "PRD.md", href: `${GITHUB_BLOB_URL}/PRD.md` },
  { label: "ARCHITECTURE.md", href: `${GITHUB_BLOB_URL}/ARCHITECTURE.md` },
  { label: "API.md", href: `${GITHUB_BLOB_URL}/API.md` },
  { label: "README.md", href: `${GITHUB_BLOB_URL}/README.md` },
] as const;

const ECOSYSTEM = [
  { label: "GitHub — arhat-dahiwale/trpc-mcp-agent", href: GITHUB_URL },
  { label: "Model Context Protocol", href: "https://modelcontextprotocol.io" },
  { label: "tRPC", href: "https://trpc.io" },
  { label: "Vercel AI SDK", href: "https://sdk.vercel.ai" },
] as const;

export function Footer() {
  return (
    <footer className="relative border-t border-cream/10 bg-ink text-cream">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <LogoMark className="h-8 w-8" />
              <span className="font-mono text-base font-semibold tracking-tight">trpc-mcp</span>
              <span className="chip !px-3 !py-1 !text-[10px]">pre-alpha</span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/60">
              Your tRPC API, agent-ready. One line of setup, zero new permission systems, both Zod
              lines supported.
            </p>
          </div>

          <nav aria-label="Docs">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-cream/50">Docs</p>
            <ul className="mt-4 space-y-3">
              {DOCS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-cream/75 transition-colors hover:text-cream"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Ecosystem">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-cream/50">Ecosystem</p>
            <ul className="mt-4 space-y-3">
              {ECOSYSTEM.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-cream/75 transition-colors hover:text-cream"
                  >
                    {link.href === GITHUB_URL && <GithubIcon className="h-3.5 w-3.5" />}
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-cream/10 pt-8">
          <p className="text-sm text-cream/55">© 2026 trpc-mcp contributors. MIT License.</p>
          <p className="font-mono text-xs text-cream/45">
            pre-alpha — the API may change before 0.1.0
          </p>
        </div>
      </div>
    </footer>
  );
}
