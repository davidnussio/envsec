import Link from "next/link";

import { TAGS, tagUrl } from "@/lib/blog";
import type { TagSlug } from "@/lib/blog";
import { cn } from "@/lib/utils";

interface TagPillProps {
  tag: TagSlug;
  count?: number;
  active?: boolean;
  className?: string;
}

export const TagPill = ({ tag, count, active, className }: TagPillProps) => (
  <Link
    aria-current={active ? "page" : undefined}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs transition-colors",
      active
        ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-300"
        : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:border-emerald-400/50 hover:text-emerald-300",
      className
    )}
    href={tagUrl(tag)}
  >
    {TAGS[tag].label}
    {count !== undefined && <span className="text-zinc-500">{count}</span>}
  </Link>
);
