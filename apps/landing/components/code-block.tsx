"use client";

import { useMemo, useState } from "react";

type Lang = "ts" | "bash";

// comment | string | keyword | known APIs | t./z. methods
const TS_TOKEN =
  /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(import|from|export|const|await|async|type|return|new)\b|\b(initTRPC|serveStdio|appRouter|McpMeta)\b|\b(t\.router|t\.procedure|z\.object|z\.string)\b/g;

type Token = { text: string; cls: string };

/** Tiny presentational highlighter for the fixed quickstart snippets. */
function tokenizeTs(code: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const match of code.matchAll(TS_TOKEN)) {
    const full = match[0];
    const index = match.index ?? 0;
    if (!full) continue;
    if (index > last) tokens.push({ text: code.slice(last, index), cls: "tok-plain" });
    const cls = match[1]
      ? "tok-comment"
      : match[2]
        ? "tok-string"
        : match[3]
          ? "tok-keyword"
          : match[4] || match[5]
            ? "tok-api"
            : "tok-plain";
    tokens.push({ text: full, cls });
    last = index + full.length;
  }
  if (last < code.length) tokens.push({ text: code.slice(last), cls: "tok-plain" });
  return tokens;
}

function BashCode({ code }: { code: string }) {
  return (
    <>
      {code.split("\n").map((line, i) => (
        <span key={i} className="block">
          {/^(?:pnpm|npx)\b/.test(line) ? (
            <>
              <span className="tok-prompt">$ </span>
              {line}
            </>
          ) : (
            <span className="tok-plain">{line}</span>
          )}
        </span>
      ))}
    </>
  );
}

function TsCode({ code }: { code: string }) {
  const tokens = useMemo(() => tokenizeTs(code), [code]);
  return (
    <>
      {tokens.map((token, i) => (
        <span key={i} className={token.cls}>
          {token.text}
        </span>
      ))}
    </>
  );
}

export function CodeBlock({ code, lang, label }: { code: string; lang: Lang; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <figure className="glass-dark flex min-w-0 flex-col rounded-2xl">
      <figcaption className="flex items-center justify-between gap-4 border-b border-cream/10 px-5 py-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-brand-bright">
          {label}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              // Clipboard unavailable — no-op.
            }
          }}
          aria-label={`Copy ${label}`}
          className="rounded-md border border-cream/20 px-3 py-1 font-mono text-xs text-cream/70 transition-colors hover:border-cream/50 hover:text-cream"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed">
        <code>{lang === "bash" ? <BashCode code={code} /> : <TsCode code={code} />}</code>
      </pre>
    </figure>
  );
}
