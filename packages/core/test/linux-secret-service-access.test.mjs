import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { Effect } from "effect";

import { KeychainAccess, LinuxSecretServiceAccessLive } from "../dist/index.js";

/** Large enough to overflow the pipe buffer, so the write hits EPIPE. */
const LARGE_SECRET = "x".repeat(1024 * 1024);

/** Puts a fake `secret-tool` that exits at once, without reading stdin, first on PATH. */
const withFakeSecretTool = async (run) => {
  const directory = mkdtempSync(path.join(tmpdir(), "envsec-secret-tool-"));
  const originalPath = process.env.PATH;
  try {
    const script = path.join(directory, "secret-tool");
    writeFileSync(script, "#!/bin/sh\necho 'keyring is locked' >&2\nexit 1\n");
    chmodSync(script, 0o755);
    process.env.PATH = `${directory}${path.delimiter}${originalPath ?? ""}`;
    await run();
  } finally {
    process.env.PATH = originalPath;
    rmSync(directory, { force: true, recursive: true });
  }
};

test(
  "set returns a KeychainError when secret-tool exits before reading stdin",
  { skip: process.platform === "win32" },
  () =>
    withFakeSecretTool(async () => {
      const error = await Effect.runPromise(
        KeychainAccess.use((keychain) =>
          keychain.set("envsec.ctx", "KEY", LARGE_SECRET)
        ).pipe(Effect.flip, Effect.provide(LinuxSecretServiceAccessLive))
      );
      assert.equal(error._tag, "KeychainError");
      assert.equal(error.command, "store");
      assert.match(error.stderr, /keyring is locked/u);
    })
);
