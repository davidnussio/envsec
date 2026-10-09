import { chmodSync, writeFileSync } from "node:fs";

/** Owner read/write only: files envsec writes may hold secret values. */
export const PRIVATE_FILE_MODE = 0o600;

/**
 * Write `content` to `path`, readable only by the current user. `mode` only
 * applies when the file is created, so an existing file (e.g. an old 0644
 * .env being overwritten) is tightened with chmod as well. On Windows the
 * mode is ignored and the file inherits the directory ACL.
 */
export const writePrivateFile = (path: string, content: string): void => {
  writeFileSync(path, content, { encoding: "utf-8", mode: PRIVATE_FILE_MODE });
  chmodSync(path, PRIVATE_FILE_MODE);
};
