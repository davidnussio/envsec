#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  return JSON.parse(readFileSync(keychainPath, "utf8"));
};

const writeKeychain = (entries) => {
  writeFileSync(keychainPath, JSON.stringify(entries), { mode: 0o600 });
};

const entryKey = (service, account) => JSON.stringify([service, account]);

const deleteEntry = (service, account) => {
  const entries = readKeychain();
  delete entries[entryKey(service, account)];
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
    set: (service, account, password) =>
      Effect.try({
        try: () => {
          const entries = readKeychain();
          entries[entryKey(service, account)] = password;
          writeKeychain(entries);
        },
        catch: (error) =>
          new KeychainError({
            command: "e2e-file-keychain-set",
            stderr: String(error),
            message: "Failed to write the E2E keychain fixture",
          }),
      }),
    get: (service, account) =>
      Effect.gen(function* () {
        const entries = yield* Effect.try({
          try: readKeychain,
          catch: (error) =>
            new KeychainError({
              command: "e2e-file-keychain-get",
              stderr: String(error),
              message: "Failed to read the E2E keychain fixture",
            }),
        });
        const password = entries[entryKey(service, account)];
        if (typeof password !== "string") {
          return yield* new SecretNotFoundError({
            key: account,
            context: service,
            message: `Secret not found: ${service}/${account}`,
          });
        }
        return password;
      }),
    remove: (service, account) =>
      Effect.try({
        try: () => deleteEntry(service, account),
        catch: (error) =>
          new KeychainError({
            command: "e2e-file-keychain-remove",
            stderr: String(error),
            message: "Failed to update the E2E keychain fixture",
          }),
      }),
  })
);

const metadataLayer = SqliteMetadataStoreLive.pipe(
  Layer.provide(DatabaseConfigFrom(databasePath))
);
const secretStoreLayer = SecretStore.layerNoDeps.pipe(
  Layer.provide(Layer.merge(fileKeychainLayer, metadataLayer))
);
const cachePath = join(dirname(databasePath), "completions.cache");
const { runCliWithLayer } = await import("../dist/cli-runner.js");

runCliWithLayer(cachePath, secretStoreLayer);
