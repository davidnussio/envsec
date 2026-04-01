import { Effect } from "effect";
import { InvalidKeyError } from "../errors.js";

export interface ParsedKey {
  readonly account: string;
  readonly service: string;
}

/**
 * Allowed characters per segment: alphanumeric, hyphens, underscores.
 * Prevents shell metacharacters, path separators, and other injection vectors
 * from reaching OS credential store CLIs.
 */
const segmentPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const maxKeyLength = 256;

export const parse = Effect.fn("SecretKey.parse")(function* (
  key: string,
  env: string
) {
  if (key.length === 0) {
    return yield* new InvalidKeyError({
      key,
      message: "Key must be a non-empty string",
    });
  }

  if (key.length > maxKeyLength) {
    return yield* new InvalidKeyError({
      key,
      message: `Key is too long (${key.length} chars, max ${maxKeyLength})`,
    });
  }

  const parts = key.split(".");

  if (parts.some((p) => p === "")) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" contains empty parts — each dot-separated segment must be non-empty`,
    });
  }

  for (const part of parts) {
    if (!segmentPattern.test(part)) {
      return yield* new InvalidKeyError({
        key,
        message: `Key segment "${part}" is invalid — use only alphanumeric characters, hyphens, and underscores (must start with alphanumeric)`,
      });
    }
  }

  const account = parts.at(-1);

  if (!account) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" must be a non-empty string`,
    });
  }

  const serviceParts = parts.slice(0, -1);
  const service =
    serviceParts.length > 0
      ? `envsec.${env}.${serviceParts.join(".")}`
      : `envsec.${env}`;

  return { service, account } satisfies ParsedKey;
});
