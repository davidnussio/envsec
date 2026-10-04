import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_DB_PATH = join(homedir(), ".envsec", "store.sqlite");

const DB_FLAG = "--db";
const DB_FLAG_PREFIX = `${DB_FLAG}=`;

/**
 * Resolve a custom database path from `--db <path>`, `--db=<path>` or the
 * ENVSEC_DB env var. Pre-parsed from argv because the SecretStore layer is
 * built before CLI parsing. Kept free of heavy imports: it runs on the
 * completion fast path.
 */
export const resolveCustomDbPath = (
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): string | undefined => {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === DB_FLAG && i + 1 < argv.length) {
      return argv[i + 1];
    }
    if (arg.startsWith(DB_FLAG_PREFIX) && arg.length > DB_FLAG_PREFIX.length) {
      return arg.slice(DB_FLAG_PREFIX.length);
    }
  }
  const envDb = env.ENVSEC_DB?.trim();
  return envDb ? envDb : undefined;
};

export const resolveDbPath = (): string =>
  resolveCustomDbPath() ?? DEFAULT_DB_PATH;
