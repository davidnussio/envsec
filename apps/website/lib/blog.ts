export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** ISO 8601 publication date. */
  date: string;
  readingTime: string;
  tags: readonly string[];
}

export const POSTS: readonly BlogPost[] = [
  {
    date: "2026-10-07",
    description:
      "Measuring every step from Effect 3 on Node to a standalone Bun binary: 12.9× faster startup and 5.8× less memory for the envsec CLI.",
    readingTime: "6 min read",
    slug: "effect-4-bun-performance",
    tags: ["Performance", "Effect", "Bun"],
    title: "From 417 to 32 milliseconds: envsec on Effect 4 and Bun",
  },
];

export const getPost = (slug: string): BlogPost => {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) {
    throw new Error(`Unknown blog post: ${slug}`);
  }
  return post;
};

export const formatPostDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
