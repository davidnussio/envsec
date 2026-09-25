export const SITE_URL = "https://envsec.dev";
export const AUTHOR = {
  name: "David Nussio",
  url: "https://github.com/davidnussio",
} as const;

/**
 * Controlled tag vocabulary. Every post tag must be one of these slugs, so
 * tags never drift ("Security" vs "security" vs "Secrets") and every tag has
 * a landing page at /blog/tag/<slug>.
 */
export const TAGS = {
  ai: {
    description:
      "Coding agents, LLM tooling and what they mean for the secrets on your machine.",
    label: "AI agents",
  },
  bun: {
    description: "Running and compiling envsec with Bun.",
    label: "Bun",
  },
  "cli-design": {
    description:
      "Small decisions that make a command-line tool pleasant: output, completions, parsing and ergonomics.",
    label: "CLI design",
  },
  comparisons: {
    description:
      "envsec next to dotenv, 1Password CLI, direnv, sops and friends — honest trade-offs.",
    label: "Comparisons",
  },
  "cross-platform": {
    description: "Making one tool behave the same on macOS, Linux and Windows.",
    label: "Cross-platform",
  },
  effect: {
    description:
      "Building envsec with Effect 4: services, layers, errors and the CLI module.",
    label: "Effect",
  },
  guides: {
    description:
      "Step-by-step walkthroughs for getting secrets out of plaintext files.",
    label: "Guides",
  },
  internals: {
    description: "How envsec works under the hood.",
    label: "Internals",
  },
  performance: {
    description: "Startup time, memory and the measurements behind them.",
    label: "Performance",
  },
  security: {
    description:
      "Threat models, plaintext secrets and what an OS credential store does and doesn't protect.",
    label: "Security",
  },
  shell: {
    description:
      "Environment variables, subshells, eval and the processes that inherit them.",
    label: "Shell",
  },
  shipping: {
    description:
      "CI, cross-platform tests and the release pipeline from a commit to Homebrew, npm and mise.",
    label: "CI & releases",
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type TagSlug = keyof typeof TAGS;

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  /** ISO 8601 publication date. */
  date: string;
  readingTime: string;
  tags: readonly TagSlug[];
}

/** Newest first. Posts sharing a date keep their order here. */
export const POSTS: readonly BlogPost[] = [
  {
    date: "2026-10-07",
    description:
      "Measuring every step from Effect 3 on Node to a standalone Bun binary: 12.9× faster startup and 5.8× less memory for the envsec CLI.",
    readingTime: "6 min read",
    slug: "effect-4-bun-performance",
    tags: ["performance", "effect", "bun"],
    title: "From 417 to 32 milliseconds: envsec on Effect 4 and Bun",
  },
  {
    date: "2026-09-25",
    description:
      "A step-by-step migration of a Node or Next.js project from a dotenv file to the OS keychain with envsec load, run, cmd and shell.",
    readingTime: "6 min read",
    slug: "migrate-from-dotenv-to-keychain",
    tags: ["guides", "shell"],
    title: "From .env to the keychain in five minutes",
  },
  {
    date: "2026-09-22",
    description:
      "An honest threat model for envsec: what the OS keychain protects, and what it doesn't: same-user processes, environment variables, argv, metadata, env-file.",
    readingTime: "7 min read",
    slug: "envsec-threat-model",
    tags: ["security", "shell"],
    title: "What envsec does not protect you from",
  },
  {
    date: "2026-09-18",
    description:
      "How envsec stores secrets through macOS security, Linux secret-tool and Windows CredWrite behind one Effect service, and why every value is base64.",
    readingTime: "8 min read",
    slug: "one-cli-three-keychains",
    tags: ["internals", "cross-platform"],
    title: "One CLI, three keychains",
  },
  {
    date: "2026-09-15",
    description:
      "envsec keeps secret values in the OS keychain and names, expiry and export records in SQLite: why, what that reveals, and what happens when one write fails.",
    readingTime: "7 min read",
    slug: "keychain-for-values-sqlite-for-metadata",
    tags: ["internals", "performance"],
    title: "Why secret values live in the keychain and metadata in SQLite",
  },
  {
    date: "2026-09-11",
    description:
      "How envsec is built on effect/cli in Effect 4: commands, flags, shared options, services and layers, typed errors with exit codes, and tests.",
    readingTime: "7 min read",
    slug: "building-a-cli-with-effect-4",
    tags: ["effect", "cli-design", "guides"],
    title: "Building a CLI with Effect 4",
  },
  {
    date: "2026-09-08",
    description:
      "How envsec's end-to-end tests reach the real macOS Keychain, GNOME Keyring and Windows Credential Manager on GitHub Actions, and what broke along the way.",
    readingTime: "7 min read",
    slug: "testing-keychains-in-ci",
    tags: ["shipping", "cross-platform"],
    title: "Testing a keychain CLI on macOS, Linux and Windows in CI",
  },
  {
    date: "2026-09-04",
    description:
      "One release tag, seven Bun targets, npm, Homebrew and mise: how the envsec release workflow ships a TypeScript CLI, and what it still does not do.",
    readingTime: "6 min read",
    slug: "shipping-a-bun-binary",
    tags: ["shipping", "bun"],
    title: "Shipping one CLI to Homebrew, npm, mise and a standalone binary",
  },
  {
    date: "2026-09-01",
    description:
      "How envsec completes contexts, keys and saved commands at Tab time in bash, zsh and fish, what each shell makes awkward, and the latency budget.",
    readingTime: "7 min read",
    slug: "dynamic-shell-completions",
    tags: ["shell", "cli-design"],
    title: "Dynamic tab completion in bash, zsh and fish",
  },
  {
    date: "2026-08-28",
    description:
      "How envsec parses expiry durations like 1y6mo (and why a month is 30 days), and how its secret command avoids modulo bias. With the entropy math.",
    readingTime: "7 min read",
    slug: "parsing-durations-and-generating-secrets",
    tags: ["cli-design", "security"],
    title: "Parsing 1y6mo and generating secrets you can't guess",
  },
  {
    date: "2026-08-25",
    description:
      "How envsec share encrypts a context with GPG, how the receiver imports it with envsec load, and what GPG does and doesn't protect.",
    readingTime: "6 min read",
    slug: "sharing-secrets-with-gpg",
    tags: ["security", "comparisons"],
    title: "Sharing secrets with a teammate, the GPG way",
  },
  {
    date: "2026-08-21",
    description:
      "Why emoji break column alignment in terminals (wcwidth, East Asian Width, VS16, ZWJ) and the 27 geometric icons envsec uses instead.",
    readingTime: "4 min read",
    slug: "no-emoji-in-the-terminal",
    tags: ["cli-design"],
    title: "Why there are no emoji in envsec's output",
  },
];

export const TAG_SLUGS = Object.keys(TAGS) as TagSlug[];

export const isTagSlug = (value: string): value is TagSlug =>
  Object.hasOwn(TAGS, value);

export const getPost = (slug: string): BlogPost => {
  const post = POSTS.find((p) => p.slug === slug);
  if (!post) {
    throw new Error(`Unknown blog post: ${slug}`);
  }
  return post;
};

export const postsByTag = (tag: TagSlug): readonly BlogPost[] =>
  POSTS.filter((post) => post.tags.includes(tag));

/** Tags that have at least one post, most used first. */
export const usedTags = (): readonly { slug: TagSlug; count: number }[] =>
  TAG_SLUGS.map((slug) => ({ count: postsByTag(slug).length, slug }))
    .filter(({ count }) => count > 0)
    .toSorted((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));

/** Posts ranked by how many tags they share with `slug`, newest first on ties. */
export const relatedPosts = (slug: string, limit = 3): readonly BlogPost[] => {
  const { tags } = getPost(slug);
  return POSTS.filter((post) => post.slug !== slug)
    .map((post) => ({
      post,
      shared: post.tags.filter((tag) => tags.includes(tag)).length,
    }))
    .filter(({ shared }) => shared > 0)
    .toSorted((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(({ post }) => post);
};

export const postUrl = (slug: string): string => `/blog/${slug}`;
export const tagUrl = (tag: TagSlug): string => `/blog/tag/${tag}`;

export const formatPostDate = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });
