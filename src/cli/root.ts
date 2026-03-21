import { Command, Options } from "@effect/cli";
import { Effect, Option, Schema } from "effect";
import { ContextName } from "../domain/context-name.js";

const decodeContext = Schema.decode(ContextName);

const context = Options.text("context").pipe(
  Options.withAlias("c"),
  Options.withDescription(
    "Context name (e.g. myapp.dev, stripe-api.prod, work.staging)"
  ),
  Options.optional
);

const debug = Options.boolean("debug").pipe(
  Options.withAlias("d"),
  Options.withDescription("Enable debug logging"),
  Options.withDefault(false)
);

export const rootCommand = Command.make("envsec", { context, debug });

/**
 * Extract and validate the required --context option.
 * Fails with a user-friendly error if missing or invalid.
 */
export const requireContext = Effect.gen(function* () {
  const { context } = yield* rootCommand;

  if (Option.isNone(context)) {
    return yield* Effect.fail(
      new Error("Missing required option --context (-c)")
    );
  }

  return yield* decodeContext(context.value);
});

/**
 * Validate an optional context value (for commands where --context is optional).
 */
export const optionalContext = Effect.gen(function* () {
  const { context } = yield* rootCommand;

  if (Option.isNone(context)) {
    return Option.none<ContextName>();
  }

  const validated = yield* decodeContext(context.value);
  return Option.some(validated);
});
