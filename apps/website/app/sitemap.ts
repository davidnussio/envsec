import type { MetadataRoute } from "next";

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
      priority: 0.5,
      url: `${siteUrl}/llms.txt`,
    },
  ];
}
