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
  return key.toUpperCase().replace(/\./g, "_").replace(/-/g, "_");
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
  private runtime: ManagedRuntime.ManagedRuntime<SecretStore, StoreError>;
  private context: string;

  private constructor(
    runtime: ManagedRuntime.ManagedRuntime<SecretStore, StoreError>,
    context: string,
  ) {
    this.runtime = runtime;
    this.context = context;
  }

  static async create(opts: EnvsecClientOptions): Promise<EnvsecClient> {
    const dbLayer = opts.dbPath
      ? DatabaseConfigFrom(opts.dbPath)
      : DatabaseConfigDefault;
    const storeLayer = SecretStore.Default.pipe(Layer.provide(dbLayer));
    const runtime = ManagedRuntime.make(storeLayer);
    return new EnvsecClient(runtime, opts.context);
  }

  async get(key: string): Promise<string | null> {
    return this.runtime.runPromise(
      SecretStore.get(this.context, key).pipe(
        Effect.catchTag("SecretNotFoundError", () => Effect.succeed(null)),
      ),
    );
  }

  async require(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === null) {
      throw new Error(
        `[envsec] Secret not found: "${key}" in context "${this.context}"`,
      );
    }
    return value;
  }

  async set(
    key: string,
    value: string,
    opts?: { expires?: string },
  ): Promise<void> {
    return this.runtime.runPromise(
      SecretStore.set(this.context, key, value, opts?.expires),
    );
  }

  async delete(key: string): Promise<void> {
    return this.runtime.runPromise(
      SecretStore.remove(this.context, key),
    );
  }

  async loadAll(): Promise<Record<string, string>> {
    const entries = await this.runtime.runPromise(
      SecretStore.list(this.context),
    );
    const result: Record<string, string> = {};
    for (const entry of entries) {
      const value = await this.get(entry.key);
      if (value !== null) {
        result[entry.key] = value;
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
