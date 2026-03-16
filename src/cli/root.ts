import { Command, Options } from "@effect/cli"

const env = Options.text("env").pipe(
  Options.withAlias("e"),
  Options.withDescription("Environment name (e.g. dev, staging, prod)"),
)

export const rootCommand = Command.make("secenv", { env })
