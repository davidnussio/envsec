import { Command, Options } from "@effect/cli";

const context = Options.text("context").pipe(
  Options.withAlias("c"),
  Options.withDescription(
    "Context name (e.g. myapp.dev, stripe-api.prod, work.staging)"
  ),
  Options.optional
);

export const rootCommand = Command.make("secenv", { context });
