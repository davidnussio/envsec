import { Context, type Effect } from "effect";
import type { MetadataStoreError, SecretNotFoundError } from "../errors.js";

export interface SecretMetadata {
  readonly created_at: string;
  readonly key: string;
  readonly updated_at: string;
}

export class MetadataStore extends Context.Tag("MetadataStore")<
  MetadataStore,
  {
    readonly upsert: (
      env: string,
      key: string
    ) => Effect.Effect<void, MetadataStoreError>;
    readonly get: (
      env: string,
      key: string
    ) => Effect.Effect<
      SecretMetadata,
      SecretNotFoundError | MetadataStoreError
    >;
    readonly remove: (
      env: string,
      key: string
    ) => Effect.Effect<void, MetadataStoreError>;
    readonly search: (
      env: string,
      pattern: string
    ) => Effect.Effect<Array<{ key: string }>, MetadataStoreError>;
    readonly list: (
      env: string
    ) => Effect.Effect<
      Array<{ key: string; updated_at: string }>,
      MetadataStoreError
    >;
  }
>() {}
