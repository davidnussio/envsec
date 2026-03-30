"use client";

import { useEffect, useRef, useState } from "react";

// Static fallback lines shown when JS is disabled or still loading
const STATIC_FALLBACK_LINES = [
  { prompt: true, text: 'envsec -c myapp.dev add api.key -v "sk-abc123"' },
  { prompt: false, text: "Secret stored in macOS Keychain" },
  { prompt: true, text: "envsec -c myapp.dev list" },
  { prompt: false, text: "  api.key        just now" },
  { prompt: true, text: 'envsec -c myapp.dev run \'curl -H "Auth: {api.key}" https://api.example.com\'' },
  { prompt: false, text: '{"status":"ok","data":[...]}' },
];

const LINES = [
  { prompt: true, text: 'envsec -c myapp.dev add api.key -v "sk-abc123"' },
  { prompt: false, text: "✓ Secret stored in macOS Keychain" },
  {
    prompt: true,
    text: 'envsec -c myapp.dev add db.password -v "p@ss!" --expires 30d',
  },
  { prompt: false, text: "✓ Secret stored (expires in 30 days)" },
  { prompt: true, text: "envsec -c myapp.dev list" },
  { prompt: false, text: "  api.key        just now" },
  { prompt: false, text: "  db.password    just now    ⏳ expires in 30d" },
  { prompt: true, text: "envsec search 'myapp.*'" },
  { prompt: false, text: "  myapp.dev      2 secrets" },
  { prompt: false, text: "  myapp.prod     5 secrets" },
  { prompt: true, text: "envsec -c myapp.dev env-file --output .env.local" },
  { prompt: false, text: "✓ Wrote 2 secrets to .env.local" },
  { prompt: true, text: "eval $(envsec -c myapp.dev env)" },
  { prompt: false, text: "✓ Exported API_KEY, DB_PASSWORD" },
  {
    prompt: true,
    text: "envsec -c myapp.dev run 'curl -H \"Auth: {api.key}\" https://api.example.com'",
  },
  { prompt: false, text: '{"status":"ok","data":[...]}' },
  { prompt: true, text: "envsec -c myapp.dev audit" },
  { prompt: false, text: "  ⚠ db.password    expires in 30 days" },
  { prompt: false, text: "  ✓ api.key        no expiry set" },
] as const;

const PROMPT_DELAY = 800;
const OUTPUT_DELAY = 300;

export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track hydration state
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || visibleLines >= LINES.length) {
      return;
    }
    const delay = LINES[visibleLines]?.prompt ? PROMPT_DELAY : OUTPUT_DELAY;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines, isHydrated]);

  const prevVisibleLines = useRef(0);
  useEffect(() => {
    if (visibleLines === prevVisibleLines.current) {
      return;
    }
    prevVisibleLines.current = visibleLines;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  });

  return (
    <div className="w-full max-w-3xl animate-terminal-fade-in overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl shadow-emerald-500/5">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-white/5 border-b px-4 py-3">
        <div className="h-3 w-3 rounded-full bg-red-500/80" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <div className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-2 font-mono text-muted-foreground text-xs">
          Terminal
        </span>
      </div>

      {/* Terminal content */}
      <div
        className="h-[28rem] overflow-y-auto overflow-x-hidden p-4 font-mono text-sm leading-relaxed"
        ref={scrollRef}
      >
        {/* Static fallback visible before JS hydration / when JS disabled */}
        {!isHydrated && (
          <div className="space-y-0">
            {STATIC_FALLBACK_LINES.map((line) => (
              <div className="flex items-start" key={line.text}>
                {line.prompt ? (
                  <>
                    <span className="mr-2 shrink-0 text-emerald-400">$</span>
                    <span className="min-w-0 break-words text-left text-zinc-200">
                      {line.text}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="invisible mr-2 w-[ch] shrink-0">$</span>
                    <span className="min-w-0 text-left text-zinc-400">
                      {line.text}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Animated content after hydration */}
        {isHydrated && (
          <>
            {LINES.slice(0, visibleLines).map((line) => (
              <div className="flex items-start" key={line.text}>
                {line.prompt ? (
                  <>
                    <span className="mr-2 shrink-0 text-emerald-400">$</span>
                    <span className="min-w-0 break-words text-left text-zinc-200">
                      {line.text}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="invisible mr-2 w-[ch] shrink-0">$</span>
                    <span className="min-w-0 text-left text-zinc-400">
                      {line.text}
                    </span>
                  </>
                )}
              </div>
            ))}
            {visibleLines < LINES.length && (
              <div className="flex items-start">
                <span className="mr-2 shrink-0 text-emerald-400">$</span>
                <span className="inline-block h-4 w-2 animate-pulse bg-emerald-400" />
              </div>
            )}
          </>
        )}
      </div>

      {/* noscript fallback for users with JS disabled */}
      <noscript>
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 p-4">
          <div className="text-center">
            <p className="mb-2 font-mono text-emerald-400 text-sm">envsec</p>
            <p className="text-muted-foreground text-xs">
              Store secrets in your OS Keychain, not in dotfiles.
            </p>
          </div>
        </div>
      </noscript>
    </div>
  );
}
