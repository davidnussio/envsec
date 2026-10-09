import Link from "next/link";

import { TagPill } from "@/components/blog/tag-pill";
import { POSTS, usedTags } from "@/lib/blog";
import type { TagSlug } from "@/lib/blog";
import { cn } from "@/lib/utils";

interface TagNavProps {
  /** The tag whose page is showing; omit on the blog index. */
  active?: TagSlug;
}

/** Topic filter shown above post lists: "All" plus every tag in use. */
export const TagNav = ({ active }: TagNavProps) => (
  <nav aria-label="Topics" className="mb-10">
    <ul className="flex flex-wrap gap-2">
      <li>
        <Link
          aria-current={active ? undefined : "page"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs transition-colors",
            active
              ? "border-white/10 text-zinc-400 hover:border-white/30 hover:text-zinc-200"
              : "border-white/30 bg-white/10 text-zinc-100"
          )}
          href="/blog"
        >
          All
          <span className="text-zinc-500">{POSTS.length}</span>
        </Link>
      </li>
      {usedTags().map(({ slug, count }) => (
        <li key={slug}>
          <TagPill active={slug === active} count={count} tag={slug} />
        </li>
      ))}
    </ul>
  </nav>
);
