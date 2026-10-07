import type { MetadataRoute } from "next";

import { POSTS } from "@/lib/blog";

const siteUrl = "https://envsec.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 1,
      url: siteUrl,
    },
    {
      changeFrequency: "daily",
      lastModified: new Date(),
      priority: 0.9,
      url: `${siteUrl}/docs`,
    },
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 0.8,
      url: `${siteUrl}/compare`,
    },
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 0.7,
      url: `${siteUrl}/blog`,
    },
    ...POSTS.map((post) => ({
      changeFrequency: "monthly" as const,
      lastModified: new Date(`${post.date}T00:00:00Z`),
      priority: 0.6,
      url: `${siteUrl}/blog/${post.slug}`,
    })),
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 0.5,
      url: `${siteUrl}/llms.txt`,
    },
  ];
}
