import { Context, Effect, Layer, Option } from "effect";
import { parse as parseSecretKey } from "../domain/secret-key.js";
import { type MetadataStoreError, SecretNotFoundError } from "../errors.js";
import { PlatformKeychainAccessLive } from "../implementations/platform-keychain-access.js";
import { SqliteMetadataStoreLive } from "../implementations/sqlite-metadata-store.js";
import {
  type DatabaseConfig,
  DatabaseConfigDefault,
} from "./database-config.js";
import { KeychainAccess } from "./keychain-access.js";
import { MetadataStore } from "./metadata-store.js";

/** Prefix to identify base64-encoded values stored by envsec.
 *  Allows backward compatibility with legacy plaintext secrets. */
const B64_PREFIX = "envsec:b64:";

/** Encode secret values to base64 before storing in OS credential stores.
 *  This avoids platform-specific encoding issues (e.g. macOS security CLI
 *  returns hex for non-ASCII values, Windows cmdkey has escaping quirks). */
const encodeValue = (value: string): string =>
  `${B64_PREFIX}${Buffer.from(value, "utf8").toString("base64")}`;

const decodeValue = (raw: string): string => {
  if (raw.startsWith(B64_PREFIX)) {
    return Buffer.from(raw.slice(B64_PREFIX.length), "base64").toString("utf8");
  }
  // Legacy: return plaintext values as-is for backward compatibility
  return raw;
};

export class SecretStore extends Context.Service<SecretStore>()(
  "envsec/SecretStore",
  {
    make: Effect.gen(function* () {
      const keychain = yield* KeychainAccess;
      const metadata = yield* MetadataStore;

      const set = Effect.fn("SecretStore.set")(function* (
        context: string,
        key: string,
        value: string,
        expiresAt?: string | null
      ) {
        yield* Effect.logDebug(`Storing secret ${context}/${key}`);
        const parsed = yield* parseSecretKey(key, context);
        // When overwriting, keep the previous value so a failed metadata write
        // can restore it instead of deleting the user's existing secret.
        const exists = yield* metadata.get(context, key).pipe(
          Effect.as(true),
          Effect.catchTag("SecretNotFoundError", () => Effect.succeed(false))
        );
        const previous = exists
          ? yield* keychain.get(parsed.service, parsed.account).pipe(
              Effect.map(Option.some),
              Effect.catchTag("SecretNotFoundError", () =>
                Effect.succeed(Option.none<string>())
              )
            )
          : Option.none<string>();
        yield* keychain.set(parsed.service, parsed.account, encodeValue(value));
        yield* metadata.upsert(context, key, expiresAt).pipe(
          Effect.catch((metadataError) =>
            Option.match(previous, {
              onNone: () => keychain.remove(parsed.service, parsed.account),
              onSome: (raw) =>
                keychain.set(parsed.service, parsed.account, raw),
            }).pipe(Effect.ignore, Effect.andThen(Effect.fail(metadataError)))
          )
        );
      });

      const get = Effect.fn("SecretStore.get")(function* (
        context: string,
        key: string
      ) {
        yield* Effect.logDebug(`Reading secret ${context}/${key}`);
        yield* metadata.get(context, key);
        const parsed = yield* parseSecretKey(key, context);
        return yield* keychain.get(parsed.service, parsed.account).pipe(
          Effect.map(decodeValue),
          Effect.catchTag("SecretNotFoundError", () =>
            Effect.fail(
              new SecretNotFoundError({
                key,
                context,
                message: `Secret "${key}" has metadata in context "${context}" but is missing from the OS keychain. Run: envsec delete -c ${context} ${key}`,
              })
            )
          )
        );
      });

      const getMetadata = Effect.fn("SecretStore.getMetadata")(function* (
        context: string,
        key: string
      ) {
        return yield* metadata.get(context, key);
      });

      const remove = Effect.fn("SecretStore.remove")(function* (
        context: string,
        key: string
      ) {
        const parsed = yield* parseSecretKey(key, context);
        yield* keychain
          .remove(parsed.service, parsed.account)
          .pipe(Effect.catchTag("KeychainError", () => Effect.void));
        yield* metadata.remove(context, key);
      });

      const search = Effect.fn("SecretStore.search")(function* (
        context: string,
        pattern: string
      ) {
        return yield* metadata.search(context, pattern);
      });

      const list = Effect.fn("SecretStore.list")(function* (context: string) {
        return yield* metadata.list(context);
      });

      const searchContexts = Effect.fn("SecretStore.searchContexts")(function* (
        pattern: string
      ) {
        return yield* metadata.searchContexts(pattern);
      });

      const listContexts = Effect.fn("SecretStore.listContexts")(function* () {
        return yield* metadata.listContexts();
      });

      const saveCommand = Effect.fn("SecretStore.saveCommand")(function* (
        name: string,
        command: string,
        context: string
      ) {
        yield* metadata.saveCommand(name, command, context);
      });

      const getCommand = Effect.fn("SecretStore.getCommand")(function* (
        name: string
      ) {
        return yield* metadata.getCommand(name);
      });

      const searchCommands = Effect.fn("SecretStore.searchCommands")(function* (
        pattern: string,
        field: "name" | "command" | "all"
      ) {
        return yield* metadata.searchCommands(pattern, field);
      });

      const listCommands = Effect.fn("SecretStore.listCommands")(function* () {
        return yield* metadata.listCommands();
      });

      const removeCommand = Effect.fn("SecretStore.removeCommand")(function* (
        name: string
      ) {
        yield* metadata.removeCommand(name);
      });

      const beginBatch = Effect.fn("SecretStore.beginBatch")(function* () {
        yield* metadata.beginBatch();
      });

      const endBatch = Effect.fn("SecretStore.endBatch")(function* () {
        yield* metadata.endBatch();
      });

      /** Run `effect` with metadata writes batched into a single persist.
       *  The batch is always closed, even if `effect` fails or is interrupted. */
      const withBatch = <A, E, R>(
        effect: Effect.Effect<A, E, R>
      ): Effect.Effect<A, E | MetadataStoreError, R> =>
        Effect.acquireUseRelease(
          metadata.beginBatch(),
          () => effect,
          () => metadata.endBatch()
        );

      const listExpiring = Effect.fn("SecretStore.listExpiring")(function* (
        context: string,
        withinMs: number
      ) {
        return yield* metadata.listExpiring(context, withinMs);
      });

      const listAllExpiring = Effect.fn("SecretStore.listAllExpiring")(
        function* (withinMs: number) {
          return yield* metadata.listAllExpiring(withinMs);
        }
      );

      const trackEnvFileExport = Effect.fn("SecretStore.trackEnvFileExport")(
        function* (context: string, path: string) {
          yield* metadata.trackEnvFileExport(context, path);
        }
      );

      const listEnvFileExports = Effect.fn("SecretStore.listEnvFileExports")(
        function* () {
          return yield* metadata.listEnvFileExports();
        }
      );

      const removeEnvFileExport = Effect.fn("SecretStore.removeEnvFileExport")(
        function* (path: string) {
          yield* metadata.removeEnvFileExport(path);
        }
      );

      return {
        set,
        get,
        getMetadata,
        remove,
        search,
        list,
        searchContexts,
        listContexts,
        saveCommand,
        getCommand,
        searchCommands,
        listCommands,
        removeCommand,
        beginBatch,
        endBatch,
        withBatch,
        listExpiring,
        listAllExpiring,
        trackEnvFileExport,
        listEnvFileExports,
        removeEnvFileExport,
      };
    }),
  }
) {
  static readonly layerNoDeps = Layer.effect(this, this.make);

  static readonly layer = (
    databaseConfig: Layer.Layer<DatabaseConfig> = DatabaseConfigDefault
  ) =>
    this.layerNoDeps.pipe(
      Layer.provide(
        Layer.merge(
          PlatformKeychainAccessLive,
          SqliteMetadataStoreLive.pipe(Layer.provide(databaseConfig))
        )
      )
    );

  static readonly Default = this.layer();

  static readonly set = (
    context: string,
    key: string,
    value: string,
    expiresAt?: string | null
  ) => this.use((store) => store.set(context, key, value, expiresAt));

  static readonly get = (context: string, key: string) =>
    this.use((store) => store.get(context, key));

  static readonly getMetadata = (context: string, key: string) =>
    this.use((store) => store.getMetadata(context, key));

  static readonly remove = (context: string, key: string) =>
    this.use((store) => store.remove(context, key));

  static readonly search = (context: string, pattern: string) =>
    this.use((store) => store.search(context, pattern));

  static readonly list = (context: string) =>
    this.use((store) => store.list(context));

  static readonly searchContexts = (pattern: string) =>
    this.use((store) => store.searchContexts(pattern));

  static readonly listContexts = () =>
    this.use((store) => store.listContexts());

  static readonly saveCommand = (
    name: string,
    command: string,
    context: string
  ) => this.use((store) => store.saveCommand(name, command, context));

  static readonly getCommand = (name: string) =>
    this.use((store) => store.getCommand(name));

  static readonly searchCommands = (
    pattern: string,
    field: "name" | "command" | "all"
  ) => this.use((store) => store.searchCommands(pattern, field));

  static readonly listCommands = () =>
    this.use((store) => store.listCommands());

  static readonly removeCommand = (name: string) =>
    this.use((store) => store.removeCommand(name));

  static readonly beginBatch = () => this.use((store) => store.beginBatch());

  static readonly endBatch = () => this.use((store) => store.endBatch());

  static readonly withBatch = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    this.use((store) => store.withBatch(effect));

  static readonly listExpiring = (context: string, withinMs: number) =>
    this.use((store) => store.listExpiring(context, withinMs));

  static readonly listAllExpiring = (withinMs: number) =>
    this.use((store) => store.listAllExpiring(withinMs));

  static readonly trackEnvFileExport = (context: string, path: string) =>
    this.use((store) => store.trackEnvFileExport(context, path));

  static readonly listEnvFileExports = () =>
    this.use((store) => store.listEnvFileExports());

  static readonly removeEnvFileExport = (path: string) =>
    this.use((store) => store.removeEnvFileExport(path));
}
