import { Effect } from "effect";
import { parse as parseSecretKey } from "../domain/secret-key.js";
import { PlatformKeychainAccessLive } from "../implementations/platform-keychain-access.js";
import { SqliteMetadataStoreLive } from "../implementations/sqlite-metadata-store.js";
import { KeychainAccess } from "./keychain-access.js";
import { MetadataStore } from "./metadata-store.js";

export class SecretStore extends Effect.Service<SecretStore>()("SecretStore", {
  accessors: true,
  dependencies: [PlatformKeychainAccessLive, SqliteMetadataStoreLive],
  effect: Effect.gen(function* () {
    const keychain = yield* KeychainAccess;
    const metadata = yield* MetadataStore;

    const set = Effect.fn("SecretStore.set")(function* (
      env: string,
      key: string,
      value: string,
      type: string
    ) {
      const parsed = yield* parseSecretKey(key, env);
      yield* keychain.set(parsed.service, parsed.account, value);
      yield* metadata.upsert(env, key, type);
    });

    const get = Effect.fn("SecretStore.get")(function* (
      env: string,
      key: string
    ) {
      const meta = yield* metadata.get(env, key);
      const parsed = yield* parseSecretKey(key, env);
      const raw = yield* keychain.get(parsed.service, parsed.account);

      switch (meta.type) {
        case "number":
          return Number(raw);
        case "boolean":
          return raw === "true";
        default:
          return raw;
      }
    });

    const remove = Effect.fn("SecretStore.remove")(function* (
      env: string,
      key: string
    ) {
      const parsed = yield* parseSecretKey(key, env);
      yield* keychain.remove(parsed.service, parsed.account);
      yield* metadata.remove(env, key);
    });

    const search = Effect.fn("SecretStore.search")(function* (
      env: string,
      pattern: string
    ) {
      return yield* metadata.search(env, pattern);
    });

    const list = Effect.fn("SecretStore.list")(function* (env: string) {
      return yield* metadata.list(env);
    });

    return { set, get, remove, search, list };
  }),
}) {}
