import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { TagPill } from "@/components/blog/tag-pill";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import {
  AUTHOR,
  formatPostDate,
  getPost,
  postUrl,
  relatedPosts,
  SITE_URL,
  TAGS,
} from "@/lib/blog";

/** Page metadata for a post, derived from its entry in POSTS. */
export const postMetadata = (slug: string): Metadata => {
  const post = getPost(slug);
  return {
    alternates: {
      canonical: postUrl(post.slug),
    },
    description: post.description,
    openGraph: {
      authors: [AUTHOR.name],
      description: post.description,
      publishedTime: post.date,
      tags: post.tags.map((tag) => TAGS[tag].label),
      title: post.title,
      type: "article",
    },
    title: post.title,
    twitter: {
      description: post.description,
      title: post.title,
    },
  };
};

interface PostLayoutProps {
  slug: string;
  /** The opening paragraph, rendered large under the title. */
  lead: React.ReactNode;
  children: React.ReactNode;
}

/** Shell shared by every post: JSON-LD, header, tags and related posts. */
export const PostLayout = ({ slug, lead, children }: PostLayoutProps) => {
  const post = getPost(slug);
  const related = relatedPosts(slug);
  const url = `${SITE_URL}${postUrl(post.slug)}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    author: { "@type": "Person", ...AUTHOR },
    datePublished: post.date,
    description: post.description,
    headline: post.title,
    keywords: post.tags.map((tag) => TAGS[tag].label).join(", "),
    mainEntityOfPage: url,
    url,
  };

  return (
    <>
      <script
        // oxlint-disable-next-line react/no-danger -- JSON-LD structured data serialized from a static, trusted object
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
        id="article-json-ld"
        type="application/ld+json"
      />
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-28 pb-24 sm:px-6">
        <article>
          <Link
            className="text-muted-foreground hover:text-foreground mb-10 inline-flex items-center gap-1.5 text-sm transition-colors"
            href="/blog"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All posts
          </Link>

          <header className="mb-12">
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-zinc-500">
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              <span aria-hidden="true">·</span>
              <span>{post.readingTime}</span>
              <span aria-hidden="true">·</span>
              <span>{AUTHOR.name}</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
              {post.title}
            </h1>
            <div className="text-muted-foreground mb-6 text-lg leading-relaxed">
              {lead}
            </div>
            <ul aria-label="Tags" className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <TagPill tag={tag} />
                </li>
              ))}
            </ul>
          </header>

          {children}
        </article>

        {related.length > 0 && (
          <aside
            aria-labelledby="related-posts"
            className="mt-20 border-t border-white/5 pt-10"
          >
            <h2
              className="mb-6 font-mono text-xs tracking-wider text-zinc-500 uppercase"
              id="related-posts"
            >
              Related posts
            </h2>
            <ul className="grid gap-4 sm:grid-cols-3">
              {related.map((p) => (
                <li key={p.slug}>
                  <Link
                    className="group block h-full rounded-lg border border-white/10 p-4 transition-colors hover:border-emerald-500/40"
                    href={postUrl(p.slug)}
                  >
                    <span className="mb-2 block font-mono text-xs text-zinc-500">
                      {p.readingTime}
                    </span>
                    <span className="block font-semibold tracking-tight group-hover:text-emerald-400">
                      {p.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>
      <Footer />
    </>
  );
};
