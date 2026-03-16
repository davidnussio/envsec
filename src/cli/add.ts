import { Command, Options, Args } from "@effect/cli"
import { Effect, Option } from "effect"
import { SecretStore } from "../services/SecretStore.js"
import { rootCommand } from "./root.js"

const key = Args.text({ name: "key" })
const wordOption = Options.text("word").pipe(
  Options.withAlias("w"),
  Options.withDescription("String value to store"),
  Options.optional,
)
const digitOption = Options.text("digit").pipe(
  Options.withAlias("d"),
  Options.withDescription("Number value to store"),
  Options.optional,
)
const boolOption = Options.boolean("bool").pipe(
  Options.withAlias("b"),
  Options.withDescription("Boolean flag to store (presence = true)"),
)

export const addCommand = Command.make(
  "add",
  { key, word: wordOption, digit: digitOption, bool: boolOption },
  ({ key, word, digit, bool }) =>
    Effect.gen(function* () {
      const { env } = yield* rootCommand

      if (Option.isSome(word)) {
        yield* SecretStore.set(env, key, word.value, "string")
      } else if (Option.isSome(digit)) {
        const num = Number(digit.value)
        if (isNaN(num)) {
          return yield* Effect.fail(new Error(`Invalid number: ${digit.value}`))
        }
        yield* SecretStore.set(env, key, digit.value, "number")
      } else if (bool) {
        yield* SecretStore.set(env, key, "true", "boolean")
      } else {
        yield* SecretStore.set(env, key, "false", "boolean")
      }

      yield* Effect.log(`Secret "${key}" stored in env "${env}"`)
    }),
)
