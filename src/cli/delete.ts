import { Command, Args } from "@effect/cli"
import { Effect } from "effect"
import { SecretStore } from "../services/SecretStore.js"
import { rootCommand } from "./root.js"

const key = Args.text({ name: "key" })

const handler = ({ key }: { key: string }) =>
  Effect.gen(function* () {
    const { env } = yield* rootCommand
    yield* SecretStore.remove(env, key)
    yield* Effect.log(`Secret "${key}" removed from env "${env}"`)
  })

export const deleteCommand = Command.make("delete", { key }, handler)

export const delCommand = Command.make("del", { key }, handler)
