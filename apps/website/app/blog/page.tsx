import type { Metadata } from "next";

import { PostList } from "@/components/blog/post-list";
import { TagNav } from "@/components/blog/tag-nav";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/feed.xml" },
  },
  description:
    "Engineering notes from building envsec — security, performance, Effect, Bun, and keeping secrets off disk.",
  title: "Blog",
};

const BlogIndexPage = () => (
  <>
    <Navbar />
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-28 pb-24 sm:px-6">
      <h1 className="mb-2 text-4xl font-bold tracking-tight">Blog</h1>
      <p className="text-muted-foreground mb-8 text-lg">
        Engineering notes from building envsec.{" "}
        {/* oxlint-disable-next-line next/no-html-link-for-pages -- the feed is a route handler, not a page */}
        <a
          className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
          href="/blog/feed.xml"
        >
          RSS
        </a>
      </p>
      <TagNav />
      <PostList posts={POSTS} />
    </main>
    <Footer />
  </>
);

export default BlogIndexPage;
