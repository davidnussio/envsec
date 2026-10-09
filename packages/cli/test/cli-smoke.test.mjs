import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("../dist/main.js", import.meta.url));
const MISSING_CONTEXT_PATTERN = /Missing required option --context/u;
const MISSING_FILE_PATTERN = /Cannot read file/u;
const INVALID_CONTEXT_PATTERN = /Context name "bad name!!" is invalid/u;
const STDIN_CLOSED_PATTERN = /stdin is closed/u;
const NO_SECRETS_PATTERN = /No secrets found/u;
const SUBCOMMANDS_PATTERN = /SUBCOMMANDS/u;
const VERSION_PATTERN = /envsec v\d/u;
const COMPLETE_COMMAND_PATTERN = /__complete/u;
const DESCRIBED_SUBCOMMAND_PATTERN = /^\s+\S.*\s{2,}\S/u;
const DELETE_ALIAS_PATTERN = /delete, del/u;
const ANSI_ESCAPE = "\u001B[";

const runCli = (...args) =>
  spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: "utf-8",
  });

const withDatabase = (run) => {
  const directory = mkdtempSync(path.join(tmpdir(), "envsec-cli-effect-4-"));
  const databasePath = path.join(directory, "store.sqlite");

  try {
    run(databasePath);
  } finally {
    rmSync(directory, { force: true, recursive: true });
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
      path.join(tmpdir(), "envsec-missing.env"),
      "--db",
      databasePath
    );

    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, MISSING_FILE_PATTERN);
  });
});

test("prints handler errors to stderr and keeps stdout clean", () => {
  withDatabase((databasePath) => {
    const result = runCli("--db", databasePath, "-c", "bad name!!", "list");

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, INVALID_CONTEXT_PATTERN);
  });
});

test("exits with the exit code of the command it runs", () => {
  withDatabase((databasePath) => {
    const result = runCli(
      "--db",
      databasePath,
      "-c",
      "smoke.context",
      "run",
      "exit 3"
    );

    assert.equal(result.status, 3);
  });
});

test("fails instead of hanging when a prompt gets no input", () => {
  withDatabase((databasePath) => {
    const result = spawnSync(
      process.execPath,
      [
        CLI_PATH,
        "--db",
        databasePath,
        "-c",
        "smoke.context",
        "run",
        "--save",
        "echo ok",
      ],
      { encoding: "utf-8", input: "", timeout: 10_000 }
    );

    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.match(result.stderr, STDIN_CLOSED_PATTERN);
  });
});

test("honours --db=<path> as well as --db <path>", () => {
  withDatabase((databasePath) => {
    const result = runCli(
      "list",
      "--context",
      "smoke.context",
      `--db=${databasePath}`
    );

    assert.equal(result.status, 0);
    assert.equal(existsSync(databasePath), true);
  });
});

test("describes every subcommand in the help output", () => {
  withDatabase((databasePath) => {
    const help = runCli("--db", databasePath, "--help");
    const subcommandLines = help.stdout
      .split("\n")
      .slice(help.stdout.split("\n").indexOf("SUBCOMMANDS") + 1)
      .filter((line) => line.trim() !== "");

    assert.ok(subcommandLines.length > 0);
    for (const line of subcommandLines) {
      assert.match(line, DESCRIBED_SUBCOMMAND_PATTERN);
    }
    assert.match(help.stdout, DELETE_ALIAS_PATTERN);
  });
});

test("serves dynamic completions for --completions=<shell> too", () => {
  for (const args of [["--completions", "zsh"], ["--completions=zsh"]]) {
    const result = runCli(...args);
    assert.equal(result.status, 0);
    assert.match(result.stdout, COMPLETE_COMMAND_PATTERN);
  }
});

test("FORCE_COLOR decides the colour of stderr notices", () => {
  withDatabase((databasePath) => {
    const runWithForceColor = (value) =>
      spawnSync(
        process.execPath,
        [CLI_PATH, "--db", databasePath, "-c", "smoke.context", "env"],
        {
          encoding: "utf-8",
          env: { ...process.env, FORCE_COLOR: value, NO_COLOR: "" },
        }
      );

    const plain = runWithForceColor("0");
    assert.match(plain.stderr, NO_SECRETS_PATTERN);
    assert.ok(!plain.stderr.includes(ANSI_ESCAPE));

    const coloured = runWithForceColor("1");
    assert.ok(coloured.stderr.includes(ANSI_ESCAPE));
  });
});
