import { Context, type Effect } from "effect";
import type { KeychainError, SecretNotFoundError } from "../errors.js";

export class KeychainAccess extends Context.Service<
  KeychainAccess,
  {
    readonly set: (
      service: string,
      account: string,
      password: string
    ) => Effect.Effect<void, KeychainError>;
    readonly get: (
      service: string,
      account: string
    ) => Effect.Effect<string, SecretNotFoundError | KeychainError>;
    readonly remove: (
      service: string,
      account: string
    ) => Effect.Effect<void, KeychainError>;
  }
>()("envsec/KeychainAccess") {}
