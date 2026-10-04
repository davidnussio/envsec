import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("a failed metadata write restores the previous secret value", async () => {
  const entries = new Map([["envsec.app.db/password", "old-raw-value"]]);
  const failingMetadata = Layer.succeed(MetadataStore, {
    get: (env, key) =>
      Effect.succeed({
        key,
        created_at: "",
        updated_at: "",
        expires_at: null,
        env,
      }),
    upsert: () =>
      Effect.fail(
        new MetadataStoreError({ operation: "upsert", message: "disk full" })
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
        new SecretNotFoundError({ key, context: env, message: "not found" })
      ),
    upsert: () =>
      Effect.fail(
        new MetadataStoreError({ operation: "upsert", message: "disk full" })
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
      refreshCache(join(blocker, "cache", "completions.json")).pipe(
        Effect.provide(storeLayer(databasePath))
      )
    );
  }));
