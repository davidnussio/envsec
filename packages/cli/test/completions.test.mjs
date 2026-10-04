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
