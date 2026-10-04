import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EnvsecClient } from "../dist/index.js";

const INVALID_CONTEXT_PATTERN = /Invalid context name "\.\.\/etc"/;
const NO_CONTEXT_PATTERN = /At least one context is required/;

test("rejects invalid context names when the client is created", async () => {
  await assert.rejects(
    EnvsecClient.create({ context: ["myapp.dev", "../etc"] }),
    INVALID_CONTEXT_PATTERN
  );
  await assert.rejects(
    EnvsecClient.create({ context: [] }),
    NO_CONTEXT_PATTERN
  );
});

test("initializes the store eagerly on create", async () => {
  const directory = mkdtempSync(join(tmpdir(), "envsec-sdk-"));
  const dbPath = join(directory, "store.sqlite");
  try {
    const client = await EnvsecClient.create({ context: "myapp.dev", dbPath });
    assert.equal(existsSync(dbPath), true);
    await client.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
