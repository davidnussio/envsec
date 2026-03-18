import { Args, Command } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const pattern = Args.text({ name: "pattern" });

export const searchCommand = Command.make(
  "search",
  { pattern },
  ({ pattern }) =>
    Effect.gen(function* () {
      const { context } = yield* rootCommand;

      if (Option.isNone(context)) {
        const results = yield* SecretStore.searchContexts(pattern);

        if (results.length === 0) {
          yield* Console.log("No contexts found.");
          return;
        }

        for (const item of results) {
          yield* Console.log(`${item.context}  (${item.count} secrets)`);
        }
        return;
      }

      const results = yield* SecretStore.search(context.value, pattern);

      if (results.length === 0) {
        yield* Console.log("No secrets found.");
        return;
      }

      for (const item of results) {
        yield* Console.log(item.key);
      }
    })
);
