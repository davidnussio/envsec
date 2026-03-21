import { Args, Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { requireContext } from "./root.js";

const key = Args.text({ name: "key" });

const handler = ({ key }: { key: string }) =>
  Effect.gen(function* () {
    const ctx = yield* requireContext;

    yield* SecretStore.remove(ctx, key);
    yield* Console.log(`🗑️  Secret "${key}" removed from context "${ctx}"`);
  });

export const deleteCommand = Command.make("delete", { key }, handler);

export const delCommand = Command.make("del", { key }, handler);
