import { randomBytes } from "node:crypto";
import { Args, Command, Options } from "@effect/cli";
import {
  bold,
  dim,
  EmptyValueError,
  expiresAtFromNow,
  formatLocalDateTime,
  icons,
  label,
  parseDuration,
  SecretStore,
} from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { optionalContext } from "./root.js";

const key = Args.text({ name: "key" }).pipe(Args.optional);

const lengthOption = Options.integer("length").pipe(
  Options.withAlias("l"),
  Options.withDescription("Length of the generated secret (default: 32)"),
  Options.withDefault(32)
);

const prefixOption = Options.text("prefix").pipe(
  Options.withAlias("p"),
  Options.withDescription(
    'Prefix to prepend to the generated secret (e.g. "sk_")'
  ),
  Options.optional
);

const expiresOption = Options.text("expires").pipe(
  Options.withAlias("e"),
  Options.withDescription("Expiry duration (e.g. 30m, 2h, 7d, 4w, 3mo, 1y)"),
  Options.optional
);

const alphanumericOption = Options.boolean("alphanumeric").pipe(
  Options.withAlias("a"),
  Options.withDescription("Use only alphanumeric characters [a-zA-Z0-9]"),
  Options.withDefault(false)
);

const specialOption = Options.boolean("special").pipe(
  Options.withAlias("s"),
  Options.withDescription(
    "Include common special characters [a-zA-Z0-9!@#$%^&*]"
  ),
  Options.withDefault(false)
);

const allCharsOption = Options.boolean("all-chars").pipe(
  Options.withAlias("A"),
  Options.withDescription(
    "Use all printable ASCII characters for maximum entropy"
  ),
  Options.withDefault(false)
);

const CHARSETS = {
  alphanumeric:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  special:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*",
  all: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?/~`\"'",
} as const;

/**
 * Generate a cryptographically secure random string from the given charset.
 * Uses rejection sampling to avoid modulo bias.
 */
const generateSecret = (length: number, charset: string): string => {
  const maxValid = 256 - (256 % charset.length);
  const result: string[] = [];

  while (result.length < length) {
    const bytes = randomBytes(length * 2);
    for (const byte of bytes) {
      if (result.length >= length) {
        break;
      }
      if (byte < maxValid) {
        result.push(charset[byte % charset.length] as string);
      }
    }
  }

  return result.join("");
};

const resolveCharset = (
  alphanumeric: boolean,
  special: boolean,
  allChars: boolean
): string => {
  if (allChars) {
    return CHARSETS.all;
  }
  if (special) {
    return CHARSETS.special;
  }
  if (alphanumeric) {
    return CHARSETS.alphanumeric;
  }
  // Default: alphanumeric
  return CHARSETS.alphanumeric;
};

const resolveCharsetLabel = (special: boolean, allChars: boolean): string => {
  if (allChars) {
    return "all printable";
  }
  if (special) {
    return "alphanumeric + special";
  }
  return "alphanumeric";
};

export const secretCommand = Command.make(
  "secret",
  {
    key,
    length: lengthOption,
    prefix: prefixOption,
    expires: expiresOption,
    alphanumeric: alphanumericOption,
    special: specialOption,
    allChars: allCharsOption,
  },
  ({ key, length, prefix, expires, alphanumeric, special, allChars }) =>
    Effect.gen(function* () {
      if (length < 1 || length > 4096) {
        return yield* new EmptyValueError({
          field: "length",
          message: "Secret length must be between 1 and 4096",
        });
      }

      const charset = resolveCharset(alphanumeric, special, allChars);
      const raw = generateSecret(length, charset);
      const value = Option.isSome(prefix) ? `${prefix.value}${raw}` : raw;
      const charsetLabel = resolveCharsetLabel(special, allChars);

      const ctx = yield* optionalContext;
      const hasKey = Option.isSome(key);
      const hasCtx = Option.isSome(ctx);

      // Standalone mode: no context or no key — just print the value
      if (!(hasCtx && hasKey)) {
        yield* Console.log(value);
        return;
      }

      // Store mode: both context and key provided
      let expiresAt: string | null = null;
      if (Option.isSome(expires)) {
        const duration = yield* parseDuration(expires.value);
        expiresAt = expiresAtFromNow(duration);
      }

      yield* SecretStore.set(ctx.value, key.value, value, expiresAt);

      yield* Console.log(
        `${icons.dice} Generated ${bold(String(length))}-char secret ${dim(`(${charsetLabel})`)}`
      );
      if (Option.isSome(prefix)) {
        yield* Console.log(
          `  ${icons.bolt} ${label("prefix", bold(prefix.value))}`
        );
      }
      yield* Console.log(
        `${icons.success} Secret ${bold(`"${key.value}"`)} stored in context ${bold(`"${ctx.value}"`)}`
      );
      if (expiresAt) {
        yield* Console.log(
          `  ${icons.clock} ${label("expires", formatLocalDateTime(expiresAt))}`
        );
      }
      yield* Console.log(`  ${icons.key} ${value}`);
    })
);
