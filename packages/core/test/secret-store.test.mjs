import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { Effect, Layer } from "effect";

import {
  DatabaseConfigFrom,
  KeychainAccess,
  MetadataStore,
  MetadataStoreError,
  refreshCache,
  SecretNotFoundError,
  SecretStore,
  SqliteMetadataStoreLive,
} from "../dist/index.js";

const memoryKeychain = (entries = new Map()) =>
  Layer.succeed(KeychainAccess, {
    get: (service, account) => {
      const value = entries.get(`${service}/${account}`);
      return value === undefined
        ? Effect.fail(
            new SecretNotFoundError({
              context: service,
              key: account,
              message: "not found",
            })
          )
        : Effect.succeed(value);
    },
    remove: (service, account) =>
      Effect.sync(() => {
        entries.delete(`${service}/${account}`);
      }),
    set: (service, account, password) =>
      Effect.sync(() => {
        entries.set(`${service}/${account}`, password);
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
  const directory = mkdtempSync(path.join(tmpdir(), "envsec-store-"));
  try {
    await run(path.join(directory, "store.sqlite"));
  } finally {
    rmSync(directory, { force: true, recursive: true });
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
    assert.deepEqual(keys.map((k) => k.key).toSorted(), ["a.key", "b.key"]);
  }));

test("a failed metadata write restores the previous secret value", async () => {
  const entries = new Map([["envsec.app.db/password", "old-raw-value"]]);
  const failingMetadata = Layer.succeed(MetadataStore, {
    get: (env, key) =>
      Effect.succeed({
        created_at: "",
        env,
        expires_at: null,
        key,
        updated_at: "",
      }),
    upsert: () =>
      Effect.fail(
        new MetadataStoreError({ message: "disk full", operation: "upsert" })
      ),
  });
  const layer = SecretStore.layerNoDeps.pipe(
    Layer.provide(Layer.merge(memoryKeychain(entries), failingMetadata))
  );

  const error = await Effect.runPromise(
    SecretStore.set("app", "db.password", "new").pipe(
      Effect.provide(layer),
      Effect.flip
    )
  );

  assert.equal(error._tag, "MetadataStoreError");
  assert.equal(entries.get("envsec.app.db/password"), "old-raw-value");
});

test("a failed metadata write removes a newly created secret", async () => {
  const entries = new Map();
  const failingMetadata = Layer.succeed(MetadataStore, {
    get: (env, key) =>
      Effect.fail(
        new SecretNotFoundError({ context: env, key, message: "not found" })
      ),
    upsert: () =>
      Effect.fail(
        new MetadataStoreError({ message: "disk full", operation: "upsert" })
      ),
  });
  const layer = SecretStore.layerNoDeps.pipe(
    Layer.provide(Layer.merge(memoryKeychain(entries), failingMetadata))
  );

  await Effect.runPromise(
    SecretStore.set("app", "db.password", "new").pipe(
      Effect.provide(layer),
      Effect.flip
    )
  );

  assert.equal(entries.has("envsec.app.db/password"), false);
});

test("refreshCache never fails the caller when the cache cannot be written", () =>
  withTempDb(async (databasePath) => {
    // A regular file where the cache directory should be makes mkdir throw.
    const blocker = `${databasePath}.blocker`;
    writeFileSync(blocker, "");
    await Effect.runPromise(
      refreshCache(path.join(blocker, "cache", "completions.json")).pipe(
        Effect.provide(storeLayer(databasePath))
      )
    );
  }));

test("rejects malformed metadata rows with a MetadataStoreError", () =>
  withTempDb(async (databasePath) => {
    // Initialise the schema, then corrupt a row behind the store's back.
    await Effect.runPromise(
      SecretStore.set("rows.ctx", "a.key", "1").pipe(
        Effect.provide(storeLayer(databasePath))
      )
    );
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(databasePath);
    db.exec("UPDATE secrets SET expires_at = X'00'");
    db.close();

    const error = await Effect.runPromise(
      SecretStore.list("rows.ctx").pipe(
        Effect.provide(storeLayer(databasePath)),
        Effect.flip
      )
    );
    assert.equal(error._tag, "MetadataStoreError");
  }));
