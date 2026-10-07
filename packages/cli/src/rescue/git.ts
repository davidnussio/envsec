/**
 * Git helpers for `envsec rescue`. Every helper degrades to "not a git repo"
 * when git is missing or the directory is not inside a work tree.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const git = (cwd: string, args: readonly string[]) =>
  spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });

/** Top-level directory of the work tree containing `directory`, if any. */
export const gitTopLevel = (directory: string): string | null => {
  const result = git(directory, ["rev-parse", "--show-toplevel"]);
  if (result.status !== 0) {
    return null;
  }
  const topLevel = result.stdout.trim();
  return topLevel === "" ? null : topLevel;
};

export interface GitFileStatus {
  readonly ignored: boolean;
  readonly topLevel: string;
  /** Committed to the repository: the secrets live on in git history. */
  readonly tracked: boolean;
}

export const gitFileStatus = (file: string): GitFileStatus | null => {
  const directory = path.dirname(file);
  const topLevel = gitTopLevel(directory);
  if (!topLevel) {
    return null;
  }
  const name = path.basename(file);
  const tracked =
    git(directory, ["ls-files", "--error-unmatch", "--", name]).status === 0;
  const ignored =
    git(directory, ["check-ignore", "-q", "--no-index", "--", name]).status ===
    0;
  return { ignored, topLevel, tracked };
};

const GITIGNORE_HEADER =
  "# Added by envsec rescue: secrets now live in the OS keychain";

/**
 * Append `patterns` to `<topLevel>/.gitignore`, skipping lines already there.
 * Returns the patterns actually added.
 */
export const appendToGitignore = (
  topLevel: string,
  patterns: readonly string[]
): string[] => {
  const gitignorePath = path.join(topLevel, ".gitignore");
  const current = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf-8")
    : "";
  const existing = new Set(current.split("\n").map((line) => line.trim()));
  const added = [...new Set(patterns)].filter(
    (pattern) => !existing.has(pattern)
  );
  if (added.length === 0) {
    return added;
  }
  const separator = current === "" || current.endsWith("\n") ? "" : "\n";
  const spacer = current === "" ? "" : "\n";
  appendFileSync(
    gitignorePath,
    `${separator}${spacer}${GITIGNORE_HEADER}\n${added.join("\n")}\n`,
    "utf-8"
  );
  return added;
};
