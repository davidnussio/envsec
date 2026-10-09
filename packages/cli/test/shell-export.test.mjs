import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { formatExport } from "../dist/shell-export.js";

const TRICKY_VALUES = [
  "plain",
  String.raw`back\slash`,
  String.raw`trailing\\`,
  "it's",
  String.raw`\'mixed\"`,
  "dollar $HOME `whoami` $(id)",
  "multi\nline",
  "spaces  and\ttabs",
  "unicode ✓ ‘curly’",
];

const hasShell = (shell) =>
  spawnSync(shell, ["-c", "exit 0"], { encoding: "utf-8" }).status === 0;

// Evaluates the export in a real shell and reads the variable back.
const roundTrip = (shell, line) => {
  const script =
    shell === "fish"
      ? `${line}; printf '%s' "$ENVSEC_T"`
      : `eval "$1"; printf '%s' "$ENVSEC_T"`;
  const args = shell === "fish" ? ["-c", script] : ["-c", script, "sh", line];
  return spawnSync(shell, args, {
    encoding: "utf-8",
    env: { PATH: process.env.PATH },
  });
};

for (const shell of ["bash", "zsh", "fish"]) {
  test(`${shell} export round-trips every value byte for byte`, (t) => {
    if (!hasShell(shell)) {
      t.skip(`${shell} not installed`);
      return;
    }
    const sh = shell === "fish" ? "fish" : shell;
    for (const value of TRICKY_VALUES) {
      const result = roundTrip(shell, formatExport("ENVSEC_T", value, sh));
      assert.equal(result.stderr, "", `${shell} stderr for ${value}`);
      assert.equal(
        result.stdout,
        value,
        `${shell} value ${JSON.stringify(value)}`
      );
    }
  });
}

test("powershell doubles every kind of single quote", () => {
  assert.equal(
    formatExport("K", "a'b‘c’d", "powershell"),
    "$env:K = 'a''b‘‘c’’d'"
  );
});
