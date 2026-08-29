import assert from "node:assert/strict";
import test from "node:test";
import { Duration, Effect, Schema } from "effect";
import { ContextName, parseDuration, parseSecretKey } from "../dist/index.js";

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
