import { EnvsecClient } from "./client.js";
import type { LoadSecretsOptions, WithSecretsOptions } from "./types.js";

/**
 * Load secrets for a context. Optionally inject into process.env.
 *
 * @example — load only
 * const secrets = await loadSecrets({ context: 'myapp.dev' })
 *
 * @example — inject at startup
 * await loadSecrets({ context: 'myapp.prod', inject: true })
 */
export async function loadSecrets(
  opts: LoadSecretsOptions,
): Promise<Record<string, string>> {
  const client = await EnvsecClient.create(opts);
  try {
    const secrets = await client.loadAll();
    if (opts.inject) await client.injectEnv();
    return secrets;
  } finally {
    await client.close();
  }
}

/**
 * Run a callback with secrets. process.env is restored after the callback.
 *
 * @example
 * const result = await withSecrets({ context: 'myapp.prod' }, async (secrets) => {
 *   return fetch(secrets['api.url'])
 * })
 */
export async function withSecrets<T>(
  opts: WithSecretsOptions,
  fn: (secrets: Record<string, string>) => Promise<T>,
): Promise<T> {
  const client = await EnvsecClient.create(opts);
  const snapshot = opts.inject ? { ...process.env } : null;
  try {
    const secrets = await client.loadAll();
    if (opts.inject) await client.injectEnv();
    return await fn(secrets);
  } finally {
    if (snapshot) {
      for (const key of Object.keys(process.env)) {
        if (!(key in snapshot)) delete process.env[key];
      }
      Object.assign(process.env, snapshot);
    }
    await client.close();
  }
}
