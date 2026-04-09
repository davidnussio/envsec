import {
  type InvalidKeyError,
  type KeychainError,
  type MetadataStoreError,
  type SecretNotFoundError,
  SecretStore,
} from "@envsec/core";
import { Effect } from "effect";

const toEnvKey = (key: string): string =>
  key.toUpperCase().replaceAll(".", "_");

/**
 * Fetch all secrets for a context and return them as a Record<string, string>
 * suitable for injection as environment variables.
 * Keys are uppercased with dots replaced by underscores (e.g. db.password → DB_PASSWORD).
 */
export const fetchContextSecrets = (
  ctx: string
): Effect.Effect<
  Record<string, string>,
  MetadataStoreError | KeychainError | InvalidKeyError,
  SecretStore
> =>
  Effect.gen(function* () {
    const secrets = yield* SecretStore.list(ctx);
    const env: Record<string, string> = {};

    if (secrets.length === 0) {
      return env;
    }

    const results = yield* Effect.forEach(
      secrets,
      (item) =>
        SecretStore.get(ctx, item.key).pipe(
          Effect.map((value) => ({
            key: item.key,
            found: true as const,
            value: String(value),
          })),
          Effect.catchTag("SecretNotFoundError", (_: SecretNotFoundError) =>
            Effect.succeed({
              key: item.key,
              found: false as const,
              value: "",
            })
          )
        ),
      { concurrency: 10 }
    );

    for (const result of results) {
      if (result.found) {
        env[toEnvKey(result.key)] = result.value;
      }
    }

    return env;
  });
