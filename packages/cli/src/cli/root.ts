import { ContextName } from "@envsec/core";
import { Config, Effect, Option, Schema } from "effect";
import { Command, Flag as Options } from "effect/cli";

const decodeContext = Schema.decodeEffect(ContextName);

const context = Options.String("context").pipe(
  Options.withAlias("c"),
  Options.withDescription(
    "Context name (e.g. myapp.dev, stripe-api.prod, work.staging). Also reads ENVSEC_CONTEXT env var."
  ),
  Options.withFallbackConfig(
    Config.String("ENVSEC_CONTEXT").pipe(Config.map((value) => value.trim()))
  ),
  Options.optional
);

const debug = Options.Boolean("debug").pipe(
  Options.withAlias("d"),
  Options.withDescription("Enable debug logging"),
  Options.withDefault(false)
);

const json = Options.Boolean("json").pipe(
  Options.withDescription("Output in JSON format for scripting"),
  Options.withDefault(false)
);

const db = Options.String("db").pipe(
  Options.withDescription(
    "Path to SQLite database file (default: ~/.envsec/store.sqlite). Also reads ENVSEC_DB env var."
  ),
  Options.optional
);

export const rootCommand = Command.make("envsec").pipe(
  Command.withDescription(
    "Secure environment secrets management using native OS credential stores"
  ),
  Command.withSharedFlags({ context, debug, json, db })
);

/**
 * The --context value, falling back to the ENVSEC_CONTEXT env var
 * (handled by Flag.withFallbackConfig). An empty value counts as unset.
 */
const rawContext = Effect.map(rootCommand, ({ context }) =>
  Option.filter(context, (value) => value !== "")
);

/**
 * Extract and validate the required --context option.
 * Fails with a user-friendly error if missing or invalid.
 */
export const requireContext = Effect.gen(function* () {
  const context = yield* rawContext;
  if (Option.isNone(context)) {
    return yield* Effect.fail(
      new Error(
        "Missing required option --context (-c) or ENVSEC_CONTEXT env var"
      )
    );
  }
  return yield* decodeContext(context.value);
});

/**
 * Validate an optional context value (for commands where --context is optional).
 */
export const optionalContext = Effect.gen(function* () {
  const context = yield* rawContext;
  if (Option.isNone(context)) {
    return Option.none<ContextName>();
  }
  return Option.some(yield* decodeContext(context.value));
});

/**
 * Check if --json flag is set.
 */
export const isJsonOutput = Effect.gen(function* () {
  const { json } = yield* rootCommand;
  return json;
});
