import {
  bold,
  EmptyValueError,
  expiresAtFromNow,
  formatLocalDateTime,
  icons,
  label,
  parseDuration,
  SecretStore,
} from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/cli";

import { readSecret } from "./prompt.js";
import { requireContext } from "./root.js";

const keyArg = Args.String("key");
const valueOption = Options.String("value").pipe(
  Options.withAlias("v"),
  Options.withDescription("Value to store (omit for interactive prompt)"),
  Options.optional
);
const expiresOption = Options.String("expires").pipe(
  Options.withAlias("e"),
  Options.withDescription("Expiry duration (e.g. 30m, 2h, 7d, 4w, 3mo, 1y)"),
  Options.optional
);

export const addCommand = Command.make(
  "add",
  // oxlint-disable-next-line sort-keys -- key order sets the flag order in --help
  { key: keyArg, value: valueOption, expires: expiresOption },
  ({ key, value, expires }) =>
    Effect.gen(function* addHandler() {
      const ctx = yield* requireContext;

      const secret = Option.isSome(value)
        ? value.value
        : yield* readSecret(`${icons.key} Enter secret value: `);

      if (secret.trim() === "") {
        return yield* new EmptyValueError({
          field: "secret",
          message: "Secret value cannot be empty",
        });
      }

      let expiresAt: string | null = null;
      if (Option.isSome(expires)) {
        const duration = yield* parseDuration(expires.value);
        expiresAt = expiresAtFromNow(duration);
      }

      yield* SecretStore.set(ctx, key, secret, expiresAt);
      yield* Console.log(
        `${icons.success} Secret ${bold(`"${key}"`)} stored in context ${bold(`"${ctx}"`)}`
      );
      if (expiresAt) {
        yield* Console.log(
          `  ${icons.clock} ${label("expires", formatLocalDateTime(expiresAt))}`
        );
      }
    })
).pipe(Command.withDescription("Store a secret in a context"));
