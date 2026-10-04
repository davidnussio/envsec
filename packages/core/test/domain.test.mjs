import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { Duration, Effect, Schema } from "effect";

import {
  ContextName,
  DatabaseConfigFrom,
  parseDuration,
  parseSecretKey,
  SecretStore,
} from "../dist/index.js";

test("accepts valid context names and rejects unsafe names", () => {
  const decodeContextName = Schema.decodeUnknownSync(ContextName);

  assert.equal(decodeContextName("myapp.dev"), "myapp.dev");
  assert.throws(() => decodeContextName("../secrets"));
});

test("parses dotted secret keys into service and account names", async () => {
  const parsed = await Effect.runPromise(
    parseSecretKey("database.primary.password", "myapp.dev")
  );

  assert.deepEqual(parsed, {
    account: "password",
    service: "envsec.myapp.dev.database.primary",
  });
});

test("rejects invalid secret key segments with a typed error", async () => {
  const error = await Effect.runPromise(
    Effect.flip(parseSecretKey("database.$password", "myapp.dev"))
  );

  assert.equal(error._tag, "InvalidKeyError");
});

test("parses combined durations", async () => {
  const duration = await Effect.runPromise(parseDuration("1d12h"));

  assert.equal(Duration.toMillis(duration), 129_600_000);
});

test("uses the database path supplied to the SecretStore layer", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "envsec-effect-4-"));
  const databasePath = path.join(directory, "custom.sqlite");

  try {
    const layer = SecretStore.layer(DatabaseConfigFrom(databasePath));
    await Effect.runPromise(
      Effect.scoped(
        SecretStore.saveCommand("test", "echo ok", "test.context").pipe(
          Effect.provide(layer)
        )
      )
    );

    assert.equal(existsSync(databasePath), true);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
