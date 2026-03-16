import { Command, Args } from "@effect/cli"
import { Effect, Console } from "effect"
import { SecretStore } from "../services/SecretStore.js"
import { rootCommand } from "./root.js"

const pattern = Args.text({ name: "pattern" })

export const searchCommand = Command.make(
  "search",
  { pattern },
  ({ pattern }) =>
    Effect.gen(function* () {
      const { env } = yield* rootCommand
      const results = yield* SecretStore.search(env, pattern)

      if (results.length === 0) {
        yield* Console.log("No secrets found.")
        return
      }

      for (const item of results) {
        yield* Console.log(`${item.key}  (${item.type})`)
      }
    }),
)
