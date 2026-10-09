import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { TagPill } from "@/components/blog/tag-pill";
import { formatPostDate, postUrl } from "@/lib/blog";
import type { BlogPost } from "@/lib/blog";

interface PostListProps {
  posts: readonly BlogPost[];
}

/**
 * The whole card is clickable through the title link's overlay; tag pills sit
 * above that overlay so they stay independent links (no nested anchors).
 */
export const PostList = ({ posts }: PostListProps) => (
  <ul className="divide-y divide-white/5 border-y border-white/5">
    {posts.map((post) => (
      <li className="group relative py-8" key={post.slug}>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-zinc-500">
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          <span aria-hidden="true">·</span>
          <span>{post.readingTime}</span>
          {post.tags.map((tag) => (
            <TagPill className="relative z-10" key={tag} tag={tag} />
          ))}
        </div>
        <h2 className="mb-2 text-xl font-semibold tracking-tight group-hover:text-emerald-400">
          <Link
            className="after:absolute after:inset-0"
            href={postUrl(post.slug)}
          >
            {post.title}
          </Link>
        </h2>
        <p className="text-muted-foreground mb-3 leading-relaxed">
          {post.description}
        </p>
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1 text-sm text-emerald-400"
        >
          Read post
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </li>
    ))}
  </ul>
);
