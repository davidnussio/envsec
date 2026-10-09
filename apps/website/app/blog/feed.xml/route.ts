import { AUTHOR, POSTS, postUrl, SITE_URL, TAGS } from "@/lib/blog";

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toRfc822 = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toUTCString();

const items = POSTS.map((post) => {
  const url = `${SITE_URL}${postUrl(post.slug)}`;
  const categories = post.tags
    .map((tag) => `      <category>${escapeXml(TAGS[tag].label)}</category>`)
    .join("\n");
  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${toRfc822(post.date)}</pubDate>
      <description>${escapeXml(post.description)}</description>
      <dc:creator>${escapeXml(AUTHOR.name)}</dc:creator>
${categories}
    </item>`;
}).join("\n");

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>envsec blog</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>Engineering notes from building envsec.</description>
    <language>en-us</language>
    <lastBuildDate>${toRfc822(POSTS[0]?.date ?? "1970-01-01")}</lastBuildDate>
${items}
  </channel>
</rss>
`;

export const dynamic = "force-static";

export const GET = () =>
  new Response(feed, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
