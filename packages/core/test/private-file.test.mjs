import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { writePrivateFile } from "../dist/index.js";

/** Permission bits as an octal string, e.g. "600". */
const modeOf = (file) => statSync(file).mode.toString(8).slice(-3);

test(
  "writePrivateFile creates and tightens files to 0600",
  { skip: process.platform === "win32" },
  () => {
    const dir = mkdtempSync(path.join(tmpdir(), "envsec-private-"));
    try {
      const fresh = path.join(dir, "fresh.env");
      writePrivateFile(fresh, "A=1\n");
      assert.equal(modeOf(fresh), "600");
      assert.equal(readFileSync(fresh, "utf-8"), "A=1\n");

      const existing = path.join(dir, "existing.env");
      writeFileSync(existing, "old");
      chmodSync(existing, 0o644);
      writePrivateFile(existing, "B=2\n");
      assert.equal(modeOf(existing), "600");
      assert.equal(readFileSync(existing, "utf-8"), "B=2\n");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  }
);
