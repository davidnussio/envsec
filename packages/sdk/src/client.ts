import {
  DatabaseConfigDefault,
  DatabaseConfigFrom,
  type MetadataStoreError,
  SecretStore,
  type UnsupportedPlatformError,
} from "@envsec/core";
import { Effect, Layer, ManagedRuntime } from "effect";
import type { EnvsecClientOptions } from "./types.js";

function toEnvKey(key: string): string {
  return key.toUpperCase().replaceAll(".", "_").replaceAll("-", "_");
}

type StoreError = UnsupportedPlatformError | MetadataStoreError;

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

  static create(opts: EnvsecClientOptions): Promise<EnvsecClient> {
    const dbLayer = opts.dbPath
      ? DatabaseConfigFrom(opts.dbPath)
      : DatabaseConfigDefault;
    const storeLayer = SecretStore.Default.pipe(Layer.provide(dbLayer));
    const runtime = ManagedRuntime.make(storeLayer);
    const contexts = Array.isArray(opts.context)
      ? opts.context
      : [opts.context];
    return Promise.resolve(new EnvsecClient(runtime, contexts));
  }

  /**
   * Get a secret by key. When multiple contexts are configured,
   * searches right-to-left (last context wins).
   */
  get(key: string): Promise<string | null> {
    return this.runtime.runPromise(
      Effect.gen(this, function* () {
        for (let i = this.contexts.length - 1; i >= 0; i--) {
          const value = yield* SecretStore.get(
            this.contexts[i] as string,
            key
          ).pipe(
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

  /** Write operations target the primary (last) context. */
  set(key: string, value: string, opts?: { expires?: string }): Promise<void> {
    return this.runtime.runPromise(
      SecretStore.set(this.primaryContext, key, value, opts?.expires)
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
    const result: Record<string, string> = {};
    for (const ctx of this.contexts) {
      const entries = await this.runtime.runPromise(SecretStore.list(ctx));
      for (const entry of entries) {
        const value = await this.runtime.runPromise(
          SecretStore.get(ctx, entry.key).pipe(
            Effect.catchTag("SecretNotFoundError", () => Effect.succeed(null))
          )
        );
        if (value !== null) {
          result[entry.key] = value;
        }
      }
    }
    return result;
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
