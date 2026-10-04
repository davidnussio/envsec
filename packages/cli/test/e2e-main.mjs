#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  DatabaseConfigFrom,
  KeychainAccess,
  KeychainError,
  SecretNotFoundError,
  SecretStore,
  SqliteMetadataStoreLive,
} from "@envsec/core";
import { Effect, Layer } from "effect";

const resolveDatabasePath = () => {
  const databaseFlagIndex = process.argv.indexOf("--db");
  if (databaseFlagIndex !== -1 && databaseFlagIndex + 1 < process.argv.length) {
    return process.argv[databaseFlagIndex + 1];
  }
  return process.env.ENVSEC_DB;
};

const databasePath = resolveDatabasePath();
const keychainPath = process.env.ENVSEC_E2E_KEYCHAIN;

if (!(databasePath && keychainPath)) {
  throw new Error("ENVSEC_DB and ENVSEC_E2E_KEYCHAIN are required");
}

const readKeychain = () => {
  if (!existsSync(keychainPath)) {
    return {};
  }
  return JSON.parse(readFileSync(keychainPath, "utf-8"));
};

const writeKeychain = (entries) => {
  writeFileSync(keychainPath, JSON.stringify(entries), { mode: 0o600 });
};

const entryKey = (service, account) => JSON.stringify([service, account]);

const deleteEntry = (service, account) => {
  const entries = readKeychain();
  Reflect.deleteProperty(entries, entryKey(service, account));
  writeKeychain(entries);
};

const args = process.argv.slice(2);
if (args[0] === "__e2e_delete_keychain") {
  deleteEntry(args[1] ?? "", args[2] ?? "");
  process.exit(0);
}

const fileKeychainLayer = Layer.succeed(
  KeychainAccess,
  KeychainAccess.of({
    get: (service, account) =>
      Effect.gen(function* getEntry() {
        const entries = yield* Effect.try({
          catch: (error) =>
            new KeychainError({
              command: "e2e-file-keychain-get",
              message: "Failed to read the E2E keychain fixture",
              stderr: String(error),
            }),
          try: readKeychain,
        });
        const password = entries[entryKey(service, account)];
        if (typeof password !== "string") {
          return yield* new SecretNotFoundError({
            context: service,
            key: account,
            message: `Secret not found: ${service}/${account}`,
          });
        }
        return password;
      }),
    remove: (service, account) =>
      Effect.try({
        catch: (error) =>
          new KeychainError({
            command: "e2e-file-keychain-remove",
            message: "Failed to update the E2E keychain fixture",
            stderr: String(error),
          }),
        try: () => deleteEntry(service, account),
      }),
    set: (service, account, password) =>
      Effect.try({
        catch: (error) =>
          new KeychainError({
            command: "e2e-file-keychain-set",
            message: "Failed to write the E2E keychain fixture",
            stderr: String(error),
          }),
        try: () => {
          const entries = readKeychain();
          entries[entryKey(service, account)] = password;
          writeKeychain(entries);
        },
      }),
  })
);

const metadataLayer = SqliteMetadataStoreLive.pipe(
  Layer.provide(DatabaseConfigFrom(databasePath))
);
const secretStoreLayer = SecretStore.layerNoDeps.pipe(
  Layer.provide(Layer.merge(fileKeychainLayer, metadataLayer))
);
const cachePath = path.join(path.dirname(databasePath), "completions.cache");
const { runCliWithLayer } = await import("../dist/cli-runner.js");

runCliWithLayer(cachePath, secretStoreLayer);
