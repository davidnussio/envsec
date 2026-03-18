import { Args, Command } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const key = Args.text({ name: "key" });

const handler = ({ key }: { key: string }) =>
  Effect.gen(function* () {
    const { context } = yield* rootCommand;

    if (Option.isNone(context)) {
      return yield* Effect.fail(
        new Error("Missing required option --context (-c)")
      );
    }
    const ctx = context.value;

    yield* SecretStore.remove(ctx, key);
    yield* Console.log(`Secret "${key}" removed from context "${ctx}"`);
  });

export const deleteCommand = Command.make("delete", { key }, handler);

export const delCommand = Command.make("del", { key }, handler);
