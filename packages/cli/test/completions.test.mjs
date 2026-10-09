import assert from "node:assert/strict";
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
