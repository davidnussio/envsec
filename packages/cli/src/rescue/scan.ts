/**
 * Discovery and planning for `envsec rescue`: find plaintext .env files under
 * a directory, group them by project and propose one context per project mode.
 *
 * Everything here is synchronous and side-effect free apart from reading the
 * filesystem, so it can be unit tested against a temporary directory.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

import { parseDotenv, toSecretKey } from "../dotenv.js";

/** Directories that never hold project secrets worth rescuing. */
const SKIPPED_DIRECTORIES = new Set([
  ".cache",
  ".git",
  ".gradle",
  ".hg",
  ".idea",
  ".next",
  ".nuxt",
  ".pnpm-store",
  ".svn",
  ".terraform",
  ".Trash",
  ".turbo",
  ".venv",
  ".vscode",
  ".yarn",
  "__pycache__",
  "bower_components",
  "build",
  "coverage",
  "dist",
  "Library",
  "node_modules",
  "out",
  "Pods",
  "target",
  "vendor",
  "venv",
]);

/** Files that mark the root of a project. */
const PROJECT_MARKERS = [
  ".git",
  "build.gradle",
  "build.gradle.kts",
  "Cargo.toml",
  "composer.json",
  "deno.json",
  "Gemfile",
  "go.mod",
  "mix.exs",
  "package.json",
  "pom.xml",
  "pubspec.yaml",
  "pyproject.toml",
  "requirements.txt",
];

/** `.env.<suffix>` files that are templates or not dotenv at all. */
const IGNORED_SUFFIXES = new Set([
  "default",
  "defaults",
  "dist",
  "example",
  "keys",
  "sample",
  "schema",
  "swp",
  "template",
  "tmpl",
  "tpl",
  "vault",
]);

const MODE_ALIASES: Record<string, string> = {
  development: "dev",
  prd: "prod",
  production: "prod",
  testing: "test",
};

/** Plain `.env` (and `.env.local`) are what an app reads in development. */
const DEFAULT_MODE = "dev";

/** Skip anything that is clearly not a hand-written dotenv file. */
const MAX_FILE_BYTES = 1024 * 1024;

export const DEFAULT_MAX_DEPTH = 8;

/** Values shorter than this are too generic to call duplicates (ports, flags). */
const MIN_DUPLICATE_LENGTH = 8;
/** Keeps `<project>.<mode>` well under the 128-char context name limit. */
const MAX_SLUG_LENGTH = 48;
const numericPattern = /^\d+$/u;
const keySegmentPattern = /^[a-z0-9][a-z0-9_-]*$/u;
const invalidSlugChars = /[^a-z0-9_-]+/gu;
const edgeSlugChars = /^[^a-z0-9]+|[^a-z0-9]+$/gu;

/** Lowercase, context-safe slug. Empty when nothing usable is left. */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replaceAll(invalidSlugChars, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replaceAll(edgeSlugChars, "");

export interface EnvFileKind {
  readonly mode: string;
  /** Load order inside a mode: later files override earlier ones. */
  readonly precedence: number;
}

/**
 * Classify a file name. Returns null for anything that is not a dotenv file
 * we should rescue (templates like `.env.example`, editor swap files...).
 *
 * `.env` < `.env.local` < `.env.<mode>` < `.env.<mode>.local`, the order used
 * by Vite, Next.js and dotenv-flow.
 */
export const classifyEnvFile = (name: string): EnvFileKind | null => {
  if (name === ".env") {
    return { mode: DEFAULT_MODE, precedence: 0 };
  }
  if (!name.startsWith(".env.")) {
    return null;
  }
  const parts = name.slice(".env.".length).toLowerCase().split(".");
  if (parts.some((part) => part === "" || IGNORED_SUFFIXES.has(part))) {
    return null;
  }
  const isLocal = parts.at(-1) === "local";
  const modeParts = isLocal ? parts.slice(0, -1) : parts;
  if (modeParts.length === 0) {
    return { mode: DEFAULT_MODE, precedence: 1 };
  }
  const rawMode = slugify(modeParts.join("-"));
  if (rawMode === "") {
    return null;
  }
  return {
    mode: MODE_ALIASES[rawMode] ?? rawMode,
    precedence: isLocal ? 3 : 2,
  };
};

export const isValidSecretKey = (key: string): boolean =>
  key.split(".").every((segment) => keySegmentPattern.test(segment));

// ── Discovery ───────────────────────────────────────────────────────

const readDirectory = (directory: string): Dirent[] => {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    // Unreadable directories (permissions, races) are simply skipped.
    return [];
  }
};

/** Absolute paths of rescuable .env files under `root`, sorted. */
export const findEnvFiles = (
  root: string,
  maxDepth: number = DEFAULT_MAX_DEPTH
): string[] => {
  const found: string[] = [];
  const walk = (directory: string, depth: number) => {
    for (const entry of readDirectory(directory)) {
      // Never follow symlinks: they lead to loops and to files outside root.
      if (entry.isSymbolicLink()) {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth && !SKIPPED_DIRECTORIES.has(entry.name)) {
          walk(fullPath, depth + 1);
        }
      } else if (entry.isFile() && classifyEnvFile(entry.name)) {
        found.push(fullPath);
      }
    }
  };
  walk(root, 0);
  return found.toSorted();
};

const hasMarker = (directory: string): boolean =>
  PROJECT_MARKERS.some((marker) => {
    try {
      statSync(path.join(directory, marker));
      return true;
    } catch {
      return false;
    }
  });

/**
 * The nearest directory (between the file and `root`, inclusive) that looks
 * like a project root. Falls back to the file's own directory.
 */
export const findProjectRoot = (file: string, root: string): string => {
  const fileDirectory = path.dirname(file);
  let directory = fileDirectory;
  while (true) {
    if (hasMarker(directory)) {
      return directory;
    }
    const relative = path.relative(root, directory);
    if (relative === "" || relative.startsWith("..")) {
      return fileDirectory;
    }
    directory = path.dirname(directory);
  }
};

// ── Planning ────────────────────────────────────────────────────────

export interface RescueEntry {
  readonly key: string;
  readonly line: number;
  /** The variable name as written in the file. */
  readonly name: string;
  readonly value: string;
}

export interface RescueFile {
  readonly context: string;
  /** Parsed assignments with a usable key and a non-empty value. */
  readonly entries: readonly RescueEntry[];
  readonly emptyNames: readonly string[];
  readonly invalidNames: readonly string[];
  readonly kind: EnvFileKind;
  readonly path: string;
  readonly unreadable: boolean;
}

export interface RescueContext {
  readonly files: readonly RescueFile[];
  readonly name: string;
  /** Winning value per key once files are layered by precedence. */
  readonly secrets: ReadonlyMap<string, RescueEntry & { file: string }>;
}

export interface RescueProject {
  readonly contexts: readonly RescueContext[];
  readonly name: string;
  readonly root: string;
}

export interface DuplicateValue {
  /** Where the value appears, as `context/key`. */
  readonly locations: readonly { context: string; name: string }[];
}

export interface RescuePlan {
  readonly duplicates: readonly DuplicateValue[];
  readonly projects: readonly RescueProject[];
  readonly root: string;
  readonly skippedExports: readonly string[];
}

const readEnvFile = (
  filePath: string
): { content: string; unreadable: boolean } => {
  try {
    if (statSync(filePath).size > MAX_FILE_BYTES) {
      return { content: "", unreadable: true };
    }
    return { content: readFileSync(filePath, "utf-8"), unreadable: false };
  } catch {
    return { content: "", unreadable: true };
  }
};

const buildFile = (
  filePath: string,
  kind: EnvFileKind,
  context: string
): RescueFile => {
  const { content, unreadable } = readEnvFile(filePath);
  const entries: RescueEntry[] = [];
  const emptyNames: string[] = [];
  const invalidNames: string[] = [];
  for (const parsed of parseDotenv(content)) {
    const key = toSecretKey(parsed.name);
    if (!isValidSecretKey(key)) {
      invalidNames.push(parsed.name);
    } else if (parsed.value.trim() === "") {
      emptyNames.push(parsed.name);
    } else {
      entries.push({ ...parsed, key });
    }
  }
  return {
    context,
    emptyNames,
    entries,
    invalidNames,
    kind,
    path: filePath,
    unreadable,
  };
};

const layerSecrets = (files: readonly RescueFile[]) => {
  const secrets = new Map<string, RescueEntry & { file: string }>();
  const ordered = files.toSorted(
    (a, b) => a.kind.precedence - b.kind.precedence
  );
  for (const file of ordered) {
    for (const entry of file.entries) {
      secrets.set(entry.key, { ...entry, file: file.path });
    }
  }
  return secrets;
};

/**
 * Give every project root a distinct, context-safe name. Roots sharing a
 * directory name are all prefixed with their parent (`client-api`,
 * `legacy-api`), then numbered if that is still not enough.
 */
const nameProjects = (roots: readonly string[], scanRoot: string) => {
  const fallback = slugify(path.basename(scanRoot)) || "project";
  const baseName = (root: string) => slugify(path.basename(root)) || fallback;
  const baseCounts = new Map<string, number>();
  for (const root of roots) {
    const base = baseName(root);
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }

  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const root of roots) {
    const base = baseName(root);
    const parent = slugify(path.basename(path.dirname(root)));
    const stem =
      (baseCounts.get(base) ?? 0) > 1 && parent !== ""
        ? slugify(`${parent}-${base}`)
        : base;
    let name = stem;
    for (let suffix = 2; used.has(name); suffix += 1) {
      name = `${stem}-${suffix}`;
    }
    used.add(name);
    names.set(root, name);
  }
  return names;
};

const findDuplicates = (
  projects: readonly RescueProject[]
): DuplicateValue[] => {
  const byValue = new Map<string, { context: string; name: string }[]>();
  for (const project of projects) {
    for (const context of project.contexts) {
      for (const secret of context.secrets.values()) {
        const { value } = secret;
        if (value.length < MIN_DUPLICATE_LENGTH || numericPattern.test(value)) {
          continue;
        }
        const locations = byValue.get(value) ?? [];
        locations.push({ context: context.name, name: secret.name });
        byValue.set(value, locations);
      }
    }
  }
  return [...byValue.values()]
    .filter((locations) => locations.length > 1)
    .map((locations) => ({ locations }))
    .toSorted((a, b) => b.locations.length - a.locations.length);
};

/**
 * Scan `root` and build the rescue plan.
 * `exportedPaths` are .env files envsec itself generated (`envsec env-file`):
 * their secrets already live in the keychain, so they are left alone.
 */
export const buildRescuePlan = (
  root: string,
  options: {
    readonly exportedPaths?: ReadonlySet<string>;
    readonly maxDepth?: number;
  } = {}
): RescuePlan => {
  const exportedPaths = options.exportedPaths ?? new Set<string>();
  const skippedExports: string[] = [];
  const filesByRoot = new Map<string, string[]>();

  for (const file of findEnvFiles(root, options.maxDepth)) {
    if (exportedPaths.has(file)) {
      skippedExports.push(file);
      continue;
    }
    const projectRoot = findProjectRoot(file, root);
    const files = filesByRoot.get(projectRoot) ?? [];
    files.push(file);
    filesByRoot.set(projectRoot, files);
  }

  const roots = [...filesByRoot.keys()].toSorted();
  const names = nameProjects(roots, root);

  const projects = roots.map((projectRoot): RescueProject => {
    const name = names.get(projectRoot) ?? "project";
    const byContext = new Map<string, RescueFile[]>();
    for (const filePath of filesByRoot.get(projectRoot) ?? []) {
      const kind = classifyEnvFile(path.basename(filePath));
      if (!kind) {
        continue;
      }
      const context = `${name}.${kind.mode}`;
      const files = byContext.get(context) ?? [];
      files.push(buildFile(filePath, kind, context));
      byContext.set(context, files);
    }
    const contexts = [...byContext.entries()]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([contextName, files]) => ({
        files,
        name: contextName,
        secrets: layerSecrets(files),
      }));
    return { contexts, name, root: projectRoot };
  });

  return {
    duplicates: findDuplicates(projects),
    projects,
    root,
    skippedExports,
  };
};

export const allContexts = (plan: RescuePlan): RescueContext[] =>
  plan.projects.flatMap((project) => project.contexts);

export const allFiles = (plan: RescuePlan): RescueFile[] =>
  allContexts(plan).flatMap((context) => context.files);

export const countSecrets = (plan: RescuePlan): number =>
  allContexts(plan).reduce((sum, context) => sum + context.secrets.size, 0);
