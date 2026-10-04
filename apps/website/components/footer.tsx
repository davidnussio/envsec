import { Shield } from "lucide-react";
import Link from "next/link";

export const Footer = () => (
  <footer className="border-t border-white/5 px-4 py-12 sm:px-6">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
      <div className="text-muted-foreground flex items-center gap-2 font-mono text-sm">
        <Shield className="h-4 w-4 text-emerald-400" />
        <span>envsec</span>
        <span className="text-zinc-700">·</span>
        <span>MIT License</span>
      </div>
      <div className="text-muted-foreground flex gap-6 text-sm">
        <Link className="hover:text-foreground transition-colors" href="/docs">
          Docs
        </Link>
        <a
          className="hover:text-foreground transition-colors"
          href="https://github.com/davidnussio/envsec"
          rel="noopener noreferrer"
          target="_blank"
        >
          GitHub
        </a>
        <a
          className="hover:text-foreground transition-colors"
          href="https://www.npmjs.com/package/envsec"
          rel="noopener noreferrer"
          target="_blank"
        >
          npm
        </a>
      </div>
    </div>
  </footer>
);
