import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const key = Args.text({ name: "key" });

export const getCommand = Command.make("get", { key }, ({ key }) =>
  Effect.gen(function* () {
    const { env } = yield* rootCommand;
    const value = yield* SecretStore.get(env, key);
    yield* Console.log(String(value));
  })
);
