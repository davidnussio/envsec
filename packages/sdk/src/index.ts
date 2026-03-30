/**
 * @envsec/sdk — Node.js / Bun SDK for envsec.
 *
 * Two APIs:
 * - EnvsecClient (class)          — multi-operation, lifecycle-managed
 * - loadSecrets / withSecrets     — one-shot functional API
 */

export { EnvsecClient } from "./client.js";
export { loadSecrets, withSecrets } from "./loader.js";
export type {
  EnvsecClientOptions,
  LoadSecretsOptions,
  WithSecretsOptions,
} from "./types.js";
