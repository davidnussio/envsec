import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCompletions } from "../dist/completions/index.js";

const ENVSEC_PATTERN = /envsec/u;
const COMPLETE_COMMAND_PATTERN = /__complete/u;

for (const shell of ["bash", "zsh", "fish"]) {
  test(`generates ${shell} completions with the internal completion command`, () => {
    const output = generateCompletions(shell, "envsec");

    assert.match(output, ENVSEC_PATTERN);
    assert.match(output, COMPLETE_COMMAND_PATTERN);
  });
}

const OPT_ARGS_PATTERN = /opt_args/u;

const shellFunction = (script, name) => {
  const start = script.indexOf(`${name}() {`);
  return script.slice(start, script.indexOf("\n}\n", start));
};

test("zsh key completion uses the context captured before nested _arguments", () => {
  const output = generateCompletions("zsh", "envsec");

  // Nested _arguments calls repopulate opt_args, dropping the top-level -c.
  assert.doesNotMatch(shellFunction(output, "_envsec_keys"), OPT_ARGS_PATTERN);
  const capture = output.indexOf('_envsec_ctx="${(Q)${opt_args[-c]');
  assert.ok(capture !== -1);
  assert.ok(capture < output.indexOf("case $state in"));
});

// ── Real-shell tests: run the generated script against a stub envsec ────

const hasShell = (shell) =>
  spawnSync(shell, ["-c", "exit 0"], { stdio: "ignore" }).status === 0;

/** A fake `envsec` on PATH: canned __complete answers, argv logged. */
const makeStubBin = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "envsec-completions-"));
  const log = path.join(dir, "calls.log");
  writeFileSync(
    path.join(dir, "envsec"),
    `#!/bin/sh
echo "$*" >> "${log}"
case "$2" in
  contexts) printf 'alpha\\nbeta\\n' ;;
  keys) [ "$3" = alpha ] && printf 'api.key\\ndb.pass\\n' ;;
  commands) printf 'deploy\\nmigrate\\n' ;;
esac
`
  );
  chmodSync(path.join(dir, "envsec"), 0o755);
  const env = {
    ...process.env,
    PATH: `${dir}${path.delimiter}${process.env.PATH}`,
  };
  delete env.ENVSEC_CONTEXT;
  const calls = () => {
    try {
      return readFileSync(log, "utf-8");
    } catch {
      return "";
    }
  };
  return { calls, dir, env };
};

const shellQuote = (word) => `'${word.replaceAll("'", "'\\''")}'`;

/** Run _envsec_completions for `words` (the last one is being completed). */
const completeBash = (words, { wordbreaks } = {}) => {
  const stub = makeStubBin();
  const script = path.join(stub.dir, "envsec.bash");
  writeFileSync(script, generateCompletions("bash", "envsec"));
  const setup =
    wordbreaks === undefined ? "" : `COMP_WORDBREAKS=${shellQuote(wordbreaks)}`;
  const { stdout } = spawnSync(
    "bash",
    [
      "--norc",
      "--noprofile",
      "-c",
      `${setup}
source ${shellQuote(script)}
COMP_WORDS=(${words.map(shellQuote).join(" ")})
COMP_CWORD=${words.length - 1}
_envsec_completions
printf '%s\\n' "\${COMPREPLY[@]}"`,
    ],
    { encoding: "utf-8", env: stub.env }
  );
  return { calls: stub.calls(), replies: stdout.split("\n").filter(Boolean) };
};

const bashOptions = { skip: !hasShell("bash") && "bash not installed" };

test("bash: cmd run/delete complete saved command names", bashOptions, () => {
  for (const sub of ["run", "delete"]) {
    assert.deepEqual(completeBash(["envsec", "cmd", sub, ""]).replies, [
      "deploy",
      "migrate",
    ]);
  }
  assert.deepEqual(completeBash(["envsec", "cmd", ""]).replies, [
    "run",
    "search",
    "list",
    "delete",
  ]);
});

test("bash: --context=value is used for key completion", bashOptions, () => {
  // Default COMP_WORDBREAKS splits on "=", bash 3.2 does not.
  for (const words of [
    ["envsec", "--context", "=", "alpha", "get", ""],
    ["envsec", "--context=alpha", "get", ""],
  ]) {
    assert.deepEqual(completeBash(words).replies, ["api.key", "db.pass"]);
  }
});

test("bash: completes the value of --context=", bashOptions, () => {
  assert.deepEqual(completeBash(["envsec", "--context", "="]).replies, [
    "alpha",
    "beta",
  ]);
  assert.deepEqual(completeBash(["envsec", "--context", "=", "al"]).replies, [
    "alpha",
  ]);
  // Without "=" in COMP_WORDBREAKS readline replaces the whole word.
  assert.deepEqual(
    completeBash(["envsec", "--context=al"], { wordbreaks: " \t\n" }).replies,
    ["--context=alpha"]
  );
});

/** Candidates fish offers for `line`, via `complete -C`. */
const completeFish = (line) => {
  const stub = makeStubBin();
  const script = path.join(stub.dir, "envsec.fish");
  writeFileSync(script, generateCompletions("fish", "envsec"));
  const { stdout } = spawnSync(
    "fish",
    [
      "--no-config",
      "-c",
      `source ${shellQuote(script)}; complete -C ${shellQuote(line)}`,
    ],
    { encoding: "utf-8", env: stub.env }
  );
  const replies = stdout
    .split("\n")
    .filter(Boolean)
    .map((candidate) => candidate.split("\t")[0]);
  return { calls: stub.calls(), replies };
};

const fishOptions = { skip: !hasShell("fish") && "fish not installed" };

test(
  "fish: cmd delete offers saved commands only, not secret keys",
  fishOptions,
  () => {
    assert.deepEqual(completeFish("envsec -c alpha cmd delete ").replies, [
      "deploy",
      "migrate",
    ]);
    assert.deepEqual(completeFish("envsec -c alpha delete ").replies, [
      "api.key",
      "db.pass",
    ]);
  }
);
