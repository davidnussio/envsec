import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Effect, Layer } from "effect";
import {
  DatabaseConfigFrom,
  KeychainAccess,
  SecretNotFoundError,
  SecretStore,
  SqliteMetadataStoreLive,
} from "../dist/index.js";

const memoryKeychain = (entries = new Map()) =>
  Layer.succeed(KeychainAccess, {
    set: (service, account, password) =>
      Effect.sync(() => {
        entries.set(`${service}/${account}`, password);
      }),
    get: (service, account) => {
      const value = entries.get(`${service}/${account}`);
      return value === undefined
        ? Effect.fail(
            new SecretNotFoundError({
              key: account,
              context: service,
              message: "not found",
            })
          )
        : Effect.succeed(value);
    },
    remove: (service, account) =>
      Effect.sync(() => {
        entries.delete(`${service}/${account}`);
      }),
  });

const storeLayer = (databasePath, keychain = memoryKeychain()) =>
  SecretStore.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        keychain,
        SqliteMetadataStoreLive.pipe(
          Layer.provide(DatabaseConfigFrom(databasePath))
        )
      )
    )
  );

const withTempDb = async (run) => {
  const directory = mkdtempSync(join(tmpdir(), "envsec-store-"));
  try {
    await run(join(directory, "store.sqlite"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("withBatch persists metadata written before a failure", () =>
  withTempDb(async (databasePath) => {
    const keychain = memoryKeychain();
    const result = await Effect.runPromise(
      SecretStore.withBatch(
        SecretStore.set("batch.ctx", "first.key", "one").pipe(
          Effect.andThen(Effect.fail(new Error("boom")))
        )
      ).pipe(Effect.provide(storeLayer(databasePath, keychain)), Effect.flip)
    );
    assert.equal(result.message, "boom");

    const keys = await Effect.runPromise(
      SecretStore.list("batch.ctx").pipe(
        Effect.provide(storeLayer(databasePath, keychain))
      )
    );
    assert.deepEqual(
      keys.map((k) => k.key),
      ["first.key"]
    );
  }));

test("withBatch persists metadata on success", () =>
  withTempDb(async (databasePath) => {
    const keychain = memoryKeychain();
    await Effect.runPromise(
      SecretStore.withBatch(
        Effect.all([
          SecretStore.set("batch.ctx", "a.key", "1"),
          SecretStore.set("batch.ctx", "b.key", "2"),
        ])
      ).pipe(Effect.provide(storeLayer(databasePath, keychain)))
    );

    const keys = await Effect.runPromise(
      SecretStore.list("batch.ctx").pipe(
        Effect.provide(storeLayer(databasePath, keychain))
      )
    );
    assert.deepEqual(keys.map((k) => k.key).sort(), ["a.key", "b.key"]);
  }));
