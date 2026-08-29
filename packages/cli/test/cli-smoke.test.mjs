import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const MISSING_CONTEXT_PATTERN = /Missing required option --context/;
const MISSING_FILE_PATTERN = /Cannot read file/;
const NO_SECRETS_PATTERN = /No secrets found/;
const SUBCOMMANDS_PATTERN = /SUBCOMMANDS/;
const VERSION_PATTERN = /envsec v\d/;

const runCli = (...args) =>
  spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf8",
  });

const withDatabase = (run) => {
  const directory = mkdtempSync(join(tmpdir(), "envsec-cli-effect-4-"));
  const databasePath = join(directory, "store.sqlite");

  try {
    run(databasePath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("renders help and version with the Effect 4 command runner", () => {
  withDatabase((databasePath) => {
    const help = runCli("--db", databasePath, "--help");
    assert.equal(help.status, 0);
    assert.match(help.stdout, SUBCOMMANDS_PATTERN);

    const version = runCli("--db", databasePath, "--version");
    assert.equal(version.status, 0);
    assert.match(version.stdout, VERSION_PATTERN);
  });
});

test("accepts shared root flags after a subcommand", () => {
  withDatabase((databasePath) => {
    const result = runCli(
      "list",
      "--context",
      "smoke.context",
      "--db",
      databasePath
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, NO_SECRETS_PATTERN);
    assert.equal(existsSync(databasePath), true);
  });
});

test("keeps the add -v alias distinct from the global version flag", () => {
  withDatabase((databasePath) => {
    const result = runCli(
      "add",
      "test.key",
      "-v",
      "test-value",
      "--db",
      databasePath
    );

    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, MISSING_CONTEXT_PATTERN);
  });
});

test("keeps omitted boolean flags optional", () => {
  withDatabase((databasePath) => {
    const result = runCli(
      "load",
      "--context",
      "smoke.context",
      "--input",
      join(tmpdir(), "envsec-missing.env"),
      "--db",
      databasePath
    );

    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, MISSING_FILE_PATTERN);
  });
});
