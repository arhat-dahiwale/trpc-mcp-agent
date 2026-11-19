"use client";

import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useState } from "react";
import { GITHUB_URL, HERO_HEADLINE, HERO_TAGLINE, INSTALL_COMMAND } from "../content";
import { GithubIcon } from "./icons";
import { LogoMark } from "./logo-mark";
import { ShaderBackground } from "./shader-background";
import { EASE_OUT } from "./reveal";

// Heavy three.js bundle loads after first paint; the SVG mark shows meanwhile.
const Logo3D = dynamic(() => import("./logo-3d").then((m) => m.Logo3D), {
  ssr: false,
  loading: () => <LogoMark className="logo-fallback-glow h-full w-full opacity-90" />,
});

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard unavailable (permissions/insecure context) — no-op.
        }
      }}
      aria-label="Copy install command"
      className="shrink-0 rounded-md border border-cream/20 px-3 py-1.5 font-mono text-xs text-cream/70 transition-colors hover:border-cream/50 hover:text-cream"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function Hero() {
  const reduced = useReducedMotion();
  return (
    <section id="top" className="relative overflow-hidden">
      <ShaderBackground className="absolute inset-0 h-full w-full" />
      {/* Scrims keep the copy readable over the shader. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/35 to-ink"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 hidden w-px bg-cream/8 lg:block"
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-28 pt-36 md:pt-44 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10 lg:pb-36">
        <motion.div
          variants={reduced ? undefined : container}
          initial={reduced ? undefined : "hidden"}
          animate={reduced ? undefined : "show"}
          className="max-w-2xl"
        >
          <motion.p variants={reduced ? undefined : item} className="chip">
            tRPC → MCP · AI SDK · pre-alpha
          </motion.p>
          <motion.h1
            variants={reduced ? undefined : item}
            className="mt-7 font-display text-[clamp(2.6rem,5.6vw,4.4rem)] font-bold leading-[1.05] tracking-tight text-cream"
          >
            {HERO_HEADLINE}
          </motion.h1>
          <motion.p
            variants={reduced ? undefined : item}
            className="mt-7 max-w-xl text-lg leading-relaxed text-cream/70"
          >
            {HERO_TAGLINE}
          </motion.p>
          <motion.div
            variants={reduced ? undefined : item}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <a href="#quickstart" className="cta-primary">
              Get started
              <span aria-hidden="true">↓</span>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="cta-ghost">
              <GithubIcon className="h-4 w-4" />
              GitHub
            </a>
          </motion.div>
          <motion.div
            variants={reduced ? undefined : item}
            className="mt-9 flex flex-wrap items-center"
          >
            <div className="glass-dark inline-flex items-center gap-4 rounded-xl px-5 py-3.5">
              <code className="font-mono text-sm text-cream/90">
                <span className="tok-prompt">$</span> {INSTALL_COMMAND}
              </code>
              <CopyButton text={INSTALL_COMMAND} />
            </div>
          </motion.div>
        </motion.div>

        <div className="relative mx-auto aspect-square w-full max-w-[480px]">
          <Logo3D className="h-full w-full" />
        </div>
      </div>
    </section>
  );
}
