import assert from "node:assert/strict";
import test from "node:test";

import { isColorEnabled } from "../dist/index.js";

const tty = { isTTY: true };
const pipe = { isTTY: false };

test("colours a TTY and leaves pipes plain by default", () => {
  assert.equal(isColorEnabled(tty, {}), true);
  assert.equal(isColorEnabled(pipe, {}), false);
  assert.equal(isColorEnabled({}, {}), false);
});

test("FORCE_COLOR=0 and FORCE_COLOR=false disable colour", () => {
  for (const value of ["0", "false"]) {
    assert.equal(isColorEnabled(tty, { FORCE_COLOR: value }), false);
    assert.equal(isColorEnabled(pipe, { FORCE_COLOR: value }), false);
  }
});

test("any other FORCE_COLOR value enables colour on a pipe", () => {
  for (const value of ["1", "2", "3", "true", ""]) {
    assert.equal(isColorEnabled(pipe, { FORCE_COLOR: value }), true);
  }
});

test("NO_COLOR disables colour, even with FORCE_COLOR set", () => {
  assert.equal(isColorEnabled(tty, { NO_COLOR: "1" }), false);
  assert.equal(
    isColorEnabled(pipe, { FORCE_COLOR: "1", NO_COLOR: "1" }),
    false
  );
});
