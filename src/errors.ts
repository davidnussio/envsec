import { Schema } from "effect";

export class SecretNotFoundError extends Schema.TaggedError<SecretNotFoundError>()(
  "SecretNotFoundError",
  {
    key: Schema.String,
    env: Schema.String,
    message: Schema.String,
  }
) {}

export class KeychainError extends Schema.TaggedError<KeychainError>()(
  "KeychainError",
  {
    command: Schema.String,
    stderr: Schema.String,
    message: Schema.String,
  }
) {}

export class MetadataStoreError extends Schema.TaggedError<MetadataStoreError>()(
  "MetadataStoreError",
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

export class InvalidKeyError extends Schema.TaggedError<InvalidKeyError>()(
  "InvalidKeyError",
  {
    key: Schema.String,
    message: Schema.String,
  }
) {}
