import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostList } from "@/components/blog/post-list";
import { TagNav } from "@/components/blog/tag-nav";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { isTagSlug, postsByTag, TAGS, tagUrl, usedTags } from "@/lib/blog";

export const dynamicParams = false;

export const generateStaticParams = () =>
  usedTags().map(({ slug }) => ({ tag: slug }));

export const generateMetadata = async (
  props: PageProps<"/blog/tag/[tag]">
): Promise<Metadata> => {
  const { tag } = await props.params;
  if (!isTagSlug(tag)) {
    return {};
  }
  const { label, description } = TAGS[tag];
  return {
    alternates: { canonical: tagUrl(tag) },
    description,
    title: `${label} — Blog`,
  };
};

const TagPage = async (props: PageProps<"/blog/tag/[tag]">) => {
  const { tag } = await props.params;
  if (!isTagSlug(tag)) {
    notFound();
  }
  const { label, description } = TAGS[tag];

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-28 pb-24 sm:px-6">
        <p className="mb-2 font-mono text-xs text-zinc-500">
          <Link className="hover:text-zinc-300" href="/blog">
            Blog
          </Link>{" "}
          / tag
        </p>
        <h1 className="mb-2 text-4xl font-bold tracking-tight">{label}</h1>
        <p className="text-muted-foreground mb-8 text-lg">{description}</p>
        <TagNav active={tag} />
        <PostList posts={postsByTag(tag)} />
      </main>
      <Footer />
    </>
  );
};

export default TagPage;
