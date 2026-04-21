"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface TerminalBlockProps {
  code: string;
}

export function TerminalBlock({ code }: TerminalBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const clean = code
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("#"))
      .join("\n");
    await navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
      <div className="flex items-center justify-between border-white/5 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
          <span className="ml-2 font-mono text-xs text-zinc-400">Terminal</span>
        </div>
        <button
          aria-label="Copy code"
          className="text-zinc-400 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code>
          {code.split("\n").map((line, i) => {
            const trimmed = line.trimStart();
            const isComment = trimmed.startsWith("#");
            const isEmpty = trimmed === "";

            if (isEmpty) {
              return <div className="h-4" key={`line-${i.toString()}`} />;
            }

            if (isComment) {
              return (
                <div className="flex items-start" key={`line-${i.toString()}`}>
                  <span className="invisible mr-2 shrink-0 select-none">$</span>
                  <span className="text-zinc-500">{line}</span>
                </div>
              );
            }

            return (
              <div className="flex items-start" key={`line-${i.toString()}`}>
                <span className="mr-2 shrink-0 select-none text-emerald-400">
                  $
                </span>
                <span className="text-zinc-200">{line}</span>
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
