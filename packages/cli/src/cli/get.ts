import { Args, Command, Options } from "@effect/cli";
import {
  bold,
  formatTimeDistance,
  icons,
  SecretStore,
  yellow,
} from "@envsec/core";
import { Console, Effect } from "effect";
import { isJsonOutput, requireContext } from "./root.js";

const key = Args.text({ name: "key" });

const quiet = Options.boolean("quiet").pipe(
  Options.withAlias("q"),
  Options.withDescription(
    "Print only the secret value, no warnings or extra output"
  ),
  Options.withDefault(false)
);

export const getCommand = Command.make(
  "get",
  { key, quiet },
  ({ key, quiet }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;
      const jsonMode = yield* isJsonOutput;

      if (quiet) {
        const value = yield* SecretStore.get(ctx, key).pipe(
          Effect.catchTag("SecretNotFoundError", (err) =>
            Effect.gen(function* () {
              if (err.message.includes("missing from the OS keychain")) {
                yield* Console.error(`${icons.warning} ${err.message}`);
                yield* Console.error(
                  `${icons.info} To clean up stale metadata, run: ${yellow(`envsec delete -c ${ctx} ${key}`)}`
                );
              }
              return yield* Effect.fail(err);
            })
          )
        );
        yield* Console.log(value);
        return;
      }

      const meta = yield* SecretStore.getMetadata(ctx, key);
      const value = yield* SecretStore.get(ctx, key).pipe(
        Effect.catchTag("SecretNotFoundError", (err) =>
          Effect.gen(function* () {
            if (err.message.includes("missing from the OS keychain")) {
              yield* Console.error(
                `${icons.warning} Secret ${bold(`"${key}"`)} has metadata but is missing from the OS keychain.`
              );
              yield* Console.error(
                `${icons.info} To clean up stale metadata, run: ${yellow(`envsec delete -c ${ctx} ${key}`)}`
              );
            }
            return yield* Effect.fail(err);
          })
        )
      );

      if (jsonMode) {
        yield* Console.log(
          JSON.stringify({
            context: ctx,
            key,
            value,
            expires_at: meta.expires_at ?? null,
          })
        );
      } else {
        yield* Console.log(value);

        if (meta.expires_at) {
          const expiresMs = new Date(`${meta.expires_at}Z`).getTime();
          const now = Date.now();
          if (expiresMs <= now) {
            yield* Console.error(
              `${icons.expired} Warning: this secret expired ${formatTimeDistance(meta.expires_at)}`
            );
          } else {
            const oneDayMs = 24 * 60 * 60 * 1000;
            if (expiresMs - now < oneDayMs) {
              yield* Console.error(
                `${icons.clock} Heads up: this secret expires ${formatTimeDistance(meta.expires_at)}`
              );
            }
          }
        }
      }
    })
);
