#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { resolveCustomDbPath, resolveDbPath } from "./db-path.js";

const dbPath = resolveDbPath();
const cachePath = path.join(path.dirname(dbPath), "completions.cache");

/** Cache TTL — 60 minutes as safety net. */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Ultra-fast completion path.
 * Reads only the JSON cache file — zero Effect, zero SQLite.
 * Falls through to the full CLI if cache is missing or stale.
 */
const tryFastComplete = (): boolean => {
  const args = process.argv.slice(2);
  if (args[0] !== "__complete") {
    return false;
  }

  const [, type = "", arg] = args;

  try {
    if (!existsSync(cachePath)) {
      return false;
    }
    const raw = readFileSync(cachePath, "utf-8");
    const cache = JSON.parse(raw) as {
      commands: string[];
      contexts: string[];
      keys: Record<string, string[]>;
      updatedAt: number;
    };

    if (Date.now() - cache.updatedAt >= CACHE_TTL_MS) {
      return false;
    }

    switch (type) {
      case "contexts": {
        for (const c of cache.contexts) {
          process.stdout.write(`${c}\n`);
        }
        return true;
      }
      case "keys": {
        if (!arg) {
          return true;
        }
        const keys = cache.keys[arg];
        if (!keys) {
          return false;
        }
        for (const k of keys) {
          process.stdout.write(`${k}\n`);
        }
        return true;
      }
      case "commands": {
        for (const c of cache.commands) {
          process.stdout.write(`${c}\n`);
        }
        return true;
      }
      default: {
        return true;
      }
    }
  } catch {
    return false;
  }
};

// Fast path — serve from cache without loading any dependencies
if (tryFastComplete()) {
  process.exit(0);
}

// Lazy import the full CLI only when needed
const run = async () => {
  const mod = (await import("./cli-runner.js")) as {
    runCli: (customDbPath: string | undefined, cachePath: string) => void;
  };
  mod.runCli(resolveCustomDbPath(), cachePath);
};

run();
