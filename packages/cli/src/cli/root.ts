import { ContextName } from "@envsec/core";
import { Effect, Option, Schema } from "effect";
import { Command, Flag as Options } from "effect/cli";

const decodeContext = Schema.decodeEffect(ContextName);

const contextFlag = Options.String("context").pipe(
  Options.withAlias("c"),
  Options.withDescription(
    "Context name (e.g. myapp.dev, stripe-api.prod, work.staging). Also reads ENVSEC_CONTEXT env var."
  ),
  Options.optional
);

const debugFlag = Options.Boolean("debug").pipe(
  Options.withAlias("d"),
  Options.withDescription("Enable debug logging"),
  Options.withDefault(false)
);

const jsonFlag = Options.Boolean("json").pipe(
  Options.withDescription("Output in JSON format for scripting"),
  Options.withDefault(false)
);

const dbFlag = Options.String("db").pipe(
  Options.withDescription(
    "Path to SQLite database file (default: ~/.envsec/store.sqlite). Also reads ENVSEC_DB env var."
  ),
  Options.optional
);

export const rootCommand = Command.make("envsec").pipe(
  Command.withDescription(
    "Secure environment secrets management using native OS credential stores"
  ),
  // oxlint-disable-next-line sort-keys -- key order sets the flag order in --help
  Command.withSharedFlags({
    context: contextFlag,
    debug: debugFlag,
    json: jsonFlag,
    db: dbFlag,
  })
);

const nonEmpty = (value: string) => value !== "";

/**
 * The context passed explicitly with --context / -c, ignoring the
 * ENVSEC_CONTEXT env var. An empty value counts as unset.
 *
 * The env var is applied separately (not via Flag.withFallbackConfig) so
 * commands like `cmd run` can tell an explicit choice from an ambient one.
 */
const flagContext = rootCommand.pipe(
  Effect.map(({ context }) => context.pipe(Option.filter(nonEmpty)))
);

/** The --context value, falling back to the ENVSEC_CONTEXT env var. */
const rawContext = flagContext.pipe(
  Effect.map(
    Option.orElse(() =>
      Option.fromNullishOr(process.env.ENVSEC_CONTEXT?.trim()).pipe(
        Option.filter(nonEmpty)
      )
    )
  )
);

/**
 * Validate the context given explicitly on the command line, if any.
 * ENVSEC_CONTEXT is deliberately not considered.
 */
export const explicitContext = Effect.gen(function* explicitContext() {
  const context = yield* flagContext;
  if (Option.isNone(context)) {
    return Option.none<ContextName>();
  }
  return Option.some(yield* decodeContext(context.value));
});

/**
 * Extract and validate the required --context option.
 * Fails with a user-friendly error if missing or invalid.
 */
export const requireContext = Effect.gen(function* requireContext() {
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
export const optionalContext = Effect.gen(function* optionalContext() {
  const context = yield* rawContext;
  if (Option.isNone(context)) {
    return Option.none<ContextName>();
  }
  return Option.some(yield* decodeContext(context.value));
});

/**
 * Check if --json flag is set.
 */
export const isJsonOutput = Effect.gen(function* isJsonOutput() {
  const { json } = yield* rootCommand;
  return json;
});
