/* oxlint-disable max-classes-per-file, unicorn/throw-new-error -- one module for all domain errors; `Schema.TaggedError<Self>()(...)` is a class factory, not a throwable call */
import { Runtime, Schema } from "effect";

export class SecretNotFoundError extends Schema.TaggedError<SecretNotFoundError>()(
  "SecretNotFoundError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    key: Schema.String,
    context: Schema.String,
    message: Schema.String,
  }
) {}

export class KeychainError extends Schema.TaggedError<KeychainError>()(
  "KeychainError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    command: Schema.String,
    stderr: Schema.String,
    message: Schema.String,
    /** The underlying error, kept for debugging (stack, code, …). */
    cause: Schema.optional(Schema.Defect()),
  }
) {}

export class MetadataStoreError extends Schema.TaggedError<MetadataStoreError>()(
  "MetadataStoreError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    operation: Schema.String,
    message: Schema.String,
    /** The underlying error, kept for debugging (stack, code, …). */
    cause: Schema.optional(Schema.Defect()),
  }
) {}

export class InvalidKeyError extends Schema.TaggedError<InvalidKeyError>()(
  "InvalidKeyError",
  {
    key: Schema.String,
    message: Schema.String,
  }
) {}

export class CommandNotFoundError extends Schema.TaggedError<CommandNotFoundError>()(
  "CommandNotFoundError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    name: Schema.String,
    message: Schema.String,
  }
) {}

export class EmptyValueError extends Schema.TaggedError<EmptyValueError>()(
  "EmptyValueError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

export class AbortedError extends Schema.TaggedError<AbortedError>()(
  "AbortedError",
  {
    message: Schema.String,
  }
) {}

export class CommandExecutionError extends Schema.TaggedError<CommandExecutionError>()(
  "CommandExecutionError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    command: Schema.String,
    exitCode: Schema.Number,
    message: Schema.String,
    /** Set when the command was killed by a signal (e.g. "SIGINT"). */
    signal: Schema.optional(Schema.String),
  }
) {
  /** Propagate the child process exit code as the CLI's own exit code. */
  override get [Runtime.errorExitCode](): number {
    return this.exitCode;
  }

  /** Ctrl-C is the user stopping the command on purpose: exit quietly. */
  override get [Runtime.errorReported](): boolean {
    return this.signal !== "SIGINT";
  }
}

export class MissingSecretsError extends Schema.TaggedError<MissingSecretsError>()(
  "MissingSecretsError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    keys: Schema.Array(Schema.String),
    context: Schema.String,
    message: Schema.String,
  }
) {}

export class UnsupportedPlatformError extends Schema.TaggedError<UnsupportedPlatformError>()(
  "UnsupportedPlatformError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    platform: Schema.String,
    message: Schema.String,
  }
) {}

export class FileAccessError extends Schema.TaggedError<FileAccessError>()(
  "FileAccessError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    path: Schema.String,
    message: Schema.String,
    /** The underlying error, kept for debugging (stack, code, …). */
    cause: Schema.optional(Schema.Defect()),
  }
) {}

export class ExpiredSecretError extends Schema.TaggedError<ExpiredSecretError>()(
  "ExpiredSecretError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    key: Schema.String,
    context: Schema.String,
    expiredAt: Schema.String,
    message: Schema.String,
  }
) {}

export class InvalidDurationError extends Schema.TaggedError<InvalidDurationError>()(
  "InvalidDurationError",
  {
    input: Schema.String,
    message: Schema.String,
  }
) {}

export class GPGEncryptionError extends Schema.TaggedError<GPGEncryptionError>()(
  "GPGEncryptionError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    recipient: Schema.String,
    message: Schema.String,
    /** The underlying error, kept for debugging (stack, code, …). */
    cause: Schema.optional(Schema.Defect()),
  }
) {}

export class ShellNotFoundError extends Schema.TaggedError<ShellNotFoundError>()(
  "ShellNotFoundError",
  // oxlint-disable-next-line sort-keys -- field order is the error's own-property and encoded order
  {
    shell: Schema.String,
    message: Schema.String,
  }
) {}
