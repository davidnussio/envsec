import {
  ContextName,
  DatabaseConfigDefault,
  DatabaseConfigFrom,
  expiresAtFromNow,
  parseDuration,
  SecretStore,
} from "@envsec/core";
import type {
  MetadataStoreError,
  UnsupportedPlatformError,
} from "@envsec/core";
import { Effect, ManagedRuntime, Schema } from "effect";

import type { EnvsecClientOptions } from "./types.js";

const toEnvKey = (key: string): string =>
  key.toUpperCase().replaceAll(".", "_").replaceAll("-", "_");

type StoreError = UnsupportedPlatformError | MetadataStoreError;

const isValidContextName = Schema.is(ContextName);

const validateContexts = (context: string | string[]): string[] => {
  const contexts = Array.isArray(context) ? context : [context];
  if (contexts.length === 0) {
    throw new Error("[envsec] At least one context is required");
  }
  for (const ctx of contexts) {
    if (!isValidContextName(ctx)) {
      throw new Error(
        `[envsec] Invalid context name "${ctx}": use only alphanumeric characters, dots, hyphens, and underscores`
      );
    }
  }
  return contexts;
};

/**
 * EnvsecClient — programmatic access to envsec secrets via Effect.
 *
 * @example
 * const client = await EnvsecClient.create({ context: 'myapp.dev' })
 * const apiKey = await client.get('api.key')
 * const all = await client.loadAll()
 * await client.injectEnv()
 * await client.close()
 */
export class EnvsecClient {
  private readonly runtime: ManagedRuntime.ManagedRuntime<
    SecretStore,
    StoreError
  >;
  private readonly contexts: string[];

  private constructor(
    runtime: ManagedRuntime.ManagedRuntime<SecretStore, StoreError>,
    contexts: string[]
  ) {
    this.runtime = runtime;
    this.contexts = contexts;
  }

  /** First context — used for single-context write operations. */
  private get primaryContext(): string {
    // Safe: constructor guarantees at least one context
    return this.contexts.at(-1) as string;
  }

  /**
   * Create a client. Rejects immediately on an invalid context name, an
   * unsupported platform or an unreadable database, instead of failing
   * later on the first read or write.
   */
  static async create(opts: EnvsecClientOptions): Promise<EnvsecClient> {
    const contexts = validateContexts(opts.context);
    const dbLayer = opts.dbPath
      ? DatabaseConfigFrom(opts.dbPath)
      : DatabaseConfigDefault;
    const runtime = ManagedRuntime.make(SecretStore.layer(dbLayer));
    try {
      await runtime.context();
    } catch (error) {
      await runtime.dispose();
      throw error;
    }
    return new EnvsecClient(runtime, contexts);
  }

  /**
   * Get a secret by key. When multiple contexts are configured,
   * searches right-to-left (last context wins).
   */
  get(key: string): Promise<string | null> {
    const { contexts } = this;
    return this.runtime.runPromise(
      Effect.gen(function* get() {
        for (let i = contexts.length - 1; i >= 0; i -= 1) {
          const value = yield* SecretStore.get(contexts[i] as string, key).pipe(
            Effect.catchTag("SecretNotFoundError", () => Effect.succeed(null))
          );
          if (value !== null) {
            return value;
          }
        }
        return null;
      })
    );
  }

  async require(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === null) {
      const label =
        this.contexts.length === 1
          ? `context "${this.contexts[0]}"`
          : `contexts [${this.contexts.map((c) => `"${c}"`).join(", ")}]`;
      throw new Error(`[envsec] Secret not found: "${key}" in ${label}`);
    }
    return value;
  }

  /**
   * Write operations target the primary (last) context.
   * `expires` is a duration such as "30m", "2h", "7d", "4w", "3mo" or "1y".
   */
  set(key: string, value: string, opts?: { expires?: string }): Promise<void> {
    const context = this.primaryContext;
    const expires = opts?.expires;
    return this.runtime.runPromise(
      Effect.gen(function* set() {
        const expiresAt =
          expires === undefined
            ? undefined
            : expiresAtFromNow(yield* parseDuration(expires));
        yield* SecretStore.set(context, key, value, expiresAt);
      })
    );
  }

  /** Delete targets the primary (last) context. */
  delete(key: string): Promise<void> {
    return this.runtime.runPromise(
      SecretStore.remove(this.primaryContext, key)
    );
  }

  /**
   * Load all secrets. When multiple contexts are configured,
   * secrets are merged left-to-right (later contexts override).
   */
  async loadAll(): Promise<Record<string, string>> {
    const { contexts } = this;
    return await this.runtime.runPromise(
      Effect.gen(function* loadAll() {
        const result: Record<string, string> = {};
        for (const ctx of contexts) {
          const entries = yield* SecretStore.list(ctx);
          for (const entry of entries) {
            const value = yield* SecretStore.get(ctx, entry.key).pipe(
              Effect.catchTag("SecretNotFoundError", () => Effect.succeed(null))
            );
            if (value !== null) {
              result[entry.key] = value;
            }
          }
        }
        return result;
      })
    );
  }

  async injectEnv(): Promise<void> {
    const secrets = await this.loadAll();
    for (const [k, v] of Object.entries(secrets)) {
      process.env[toEnvKey(k)] = v;
    }
  }

  async close(): Promise<void> {
    await this.runtime.dispose();
  }
}
