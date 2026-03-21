import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

const key = Args.text({ name: "key" });

export const getCommand = Command.make("get", { key }, ({ key }) =>
  Effect.gen(function* () {
    const ctx = yield* requireContext;

    const value = yield* SecretStore.get(ctx, key);
    yield* Console.log(value);
  })
);
