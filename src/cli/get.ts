import { Args, Command } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const key = Args.text({ name: "key" });

export const getCommand = Command.make("get", { key }, ({ key }) =>
  Effect.gen(function* () {
    const { context } = yield* rootCommand;

    if (Option.isNone(context)) {
      return yield* Effect.fail(
        new Error("Missing required option --context (-c)")
      );
    }

    const value = yield* SecretStore.get(context.value, key);
    yield* Console.log(value);
  })
);
