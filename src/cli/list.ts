import { Command } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

export const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const { env } = yield* rootCommand;
    const results = yield* SecretStore.list(env);

    if (results.length === 0) {
      yield* Console.log("No secrets found.");
      return;
    }

    for (const item of results) {
      yield* Console.log(
        `${item.key}  (${item.type})  updated: ${item.updated_at}`
      );
    }
  })
);
