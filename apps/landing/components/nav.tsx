"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GITHUB_URL } from "../content";
import { GithubIcon } from "./icons";
import { LogoMark } from "./logo-mark";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#quickstart", label: "Quickstart" },
  { href: "#packages", label: "Packages" },
] as const;

export function Nav() {
  const reduced = useReducedMotion();
  return (
    <motion.header
      initial={reduced ? false : { y: -32, opacity: 0 }}
      animate={reduced ? undefined : { y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="glass-dark border-x-0 border-t-0">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <a href="#top" className="flex shrink-0 items-center gap-3">
            <LogoMark className="h-7 w-7" />
            <span className="font-mono text-sm font-semibold tracking-tight text-cream">
              trpc-mcp
            </span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-cream/70 transition-colors hover:text-cream"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-cream/25 px-4 py-2 text-sm font-medium text-cream transition-colors hover:border-cream/50 hover:bg-cream/10"
          >
            <GithubIcon className="h-4 w-4" />
            GitHub
          </a>
        </nav>
      </div>
    </motion.header>
  );
}
