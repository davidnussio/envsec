import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { formatPostDate, POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  alternates: {
    canonical: "/blog",
  },
  description:
    "Engineering notes from building envsec — performance, Effect, Bun, and keeping secrets off disk.",
  title: "Blog",
};

const BlogIndexPage = () => (
  <>
    <Navbar />
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-28 pb-24 sm:px-6">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Blog</h1>
      <p className="text-muted-foreground mb-12 text-lg">
        Engineering notes from building envsec.
      </p>

      <ul className="divide-y divide-white/5 border-y border-white/5">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              className="group block py-8 transition-colors"
              href={`/blog/${post.slug}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-zinc-500">
                <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                <span aria-hidden="true">·</span>
                <span>{post.readingTime}</span>
                {post.tags.map((tag) => (
                  <span
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-emerald-400"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="mb-2 text-xl font-semibold tracking-tight group-hover:text-emerald-400">
                {post.title}
              </h2>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                {post.description}
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-emerald-400">
                Read post
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
    <Footer />
  </>
);

export default BlogIndexPage;
