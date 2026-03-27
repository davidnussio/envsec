"use client";

import { useEffect, useRef, useState } from "react";

interface TerminalLine {
  readonly prompt: boolean;
  readonly text: string;
}

const PROMPT_DELAY = 600;
const OUTPUT_DELAY = 250;

export function UseCaseTerminal({ lines }: { lines: readonly TerminalLine[] }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevVisible = useRef(0);

  useEffect(() => {
    if (visibleLines >= lines.length) {
      return;
    }
    const delay = lines[visibleLines]?.prompt ? PROMPT_DELAY : OUTPUT_DELAY;
    const timer = setTimeout(() => setVisibleLines((v) => v + 1), delay);
    return () => clearTimeout(timer);
  }, [visibleLines, lines]);

  useEffect(() => {
    if (visibleLines === prevVisible.current) {
      return;
    }
    prevVisible.current = visibleLines;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  });

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-lg">
      <div className="flex items-center gap-2 border-white/5 border-b px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
        <span className="ml-2 font-mono text-muted-foreground text-xs">
          Terminal
        </span>
      </div>
      <div
        className="max-h-64 overflow-y-auto overflow-x-hidden p-4 font-mono text-sm leading-relaxed"
        ref={scrollRef}
      >
        {lines.slice(0, visibleLines).map((line, i) => (
          <div
            className="flex items-start"
            key={`${line.text}-${
              // biome-ignore lint/suspicious/noArrayIndexKey: Using index as key is acceptable here because the list is static and does not change order.
              i
            }`}
          >
            {line.prompt ? (
              <>
                <span className="mr-2 shrink-0 text-emerald-400">$</span>
                <span className="wrap-break-word min-w-0 whitespace-pre-wrap text-left text-zinc-200">
                  {line.text}
                </span>
              </>
            ) : (
              <>
                <span className="invisible mr-2 shrink-0">$</span>
                <span className="min-w-0 whitespace-pre-wrap text-left text-zinc-400">
                  {line.text}
                </span>
              </>
            )}
          </div>
        ))}
        {visibleLines < lines.length && (
          <div className="flex items-start">
            <span className="mr-2 shrink-0 text-emerald-400">$</span>
            <span className="inline-block h-4 w-2 animate-pulse bg-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );
}
