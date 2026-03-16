import { Command, Args } from "@effect/cli"
import { Effect, Console } from "effect"
import { SecretStore } from "../services/SecretStore.js"
import { rootCommand } from "./root.js"

const key = Args.text({ name: "key" })

export const readCommand = Command.make(
  "read",
  { key },
  ({ key }) =>
    Effect.gen(function* () {
      const { env } = yield* rootCommand
      const value = yield* SecretStore.get(env, key)
      yield* Console.log(String(value))
    }),
)
