/**
 * @envsec/core — Platform-agnostic secrets management engine.
 * Used by both the envsec CLI and @envsec/sdk.
 * Zero CLI coupling — no yargs, no chalk, no ora.
 */

// ── Errors ──────────────────────────────────────────────────────────
export {
  AbortedError,
  CommandExecutionError,
  CommandNotFoundError,
  EmptyValueError,
  ExpiredSecretError,
  FileAccessError,
  GPGEncryptionError,
  InvalidDurationError,
  InvalidKeyError,
  KeychainError,
  MetadataStoreError,
  MissingSecretsError,
  SecretNotFoundError,
  UnsupportedPlatformError,
} from "./errors.js";

// ── Domain ──────────────────────────────────────────────────────────
export { ContextName } from "./domain/context-name.js";
export type { ContextName as ContextNameType } from "./domain/context-name.js";
export { parse as parseSecretKey } from "./domain/secret-key.js";
export type { ParsedKey } from "./domain/secret-key.js";
export {
  expiresAtFromNow,
  formatLocalDateTime,
  formatTimeDistance,
  parseDuration,
} from "./domain/duration.js";

// ── Services ────────────────────────────────────────────────────────
export { SecretStore } from "./services/secret-store.js";
export { KeychainAccess } from "./services/keychain-access.js";
export {
  MetadataStore,
  type CommandMetadata,
  type EnvFileExport,
  type SecretMetadata,
} from "./services/metadata-store.js";
export {
  DatabaseConfig,
  DatabaseConfigDefault,
  DatabaseConfigFrom,
  type DatabaseConfigShape,
} from "./services/database-config.js";
export { refreshCache } from "./services/completion-cache.js";

// ── Implementations ─────────────────────────────────────────────────
export { PlatformKeychainAccessLive } from "./implementations/platform-keychain-access.js";
export { MacOsKeychainAccessLive } from "./implementations/mac-os-keychain-access.js";
export { LinuxSecretServiceAccessLive } from "./implementations/linux-secret-service-access.js";
export { WindowsCredentialManagerAccessLive } from "./implementations/windows-credential-manager-access.js";
export { SqliteMetadataStoreLive } from "./implementations/sqlite-metadata-store.js";

// ── UI ──────────────────────────────────────────────────────────────
export {
  badge,
  blue,
  bold,
  cyan,
  dim,
  green,
  icons,
  indent,
  label,
  magenta,
  red,
  separator,
  white,
  yellow,
} from "./ui.js";
