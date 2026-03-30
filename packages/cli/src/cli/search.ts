import { Args, Command } from "@effect/cli";
import { bold, dim, icons, SecretStore } from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { isJsonOutput, optionalContext } from "./root.js";

const pattern = Args.text({ name: "pattern" });

export const searchCommand = Command.make(
  "search",
  { pattern },
  ({ pattern }) =>
    Effect.gen(function* () {
      const context = yield* optionalContext;
      const jsonMode = yield* isJsonOutput;

      if (Option.isNone(context)) {
        const results = yield* SecretStore.searchContexts(pattern);

        if (jsonMode) {
          yield* Console.log(JSON.stringify(results));
          return;
        }

        if (results.length === 0) {
          yield* Console.log(`${icons.empty} No contexts found.`);
          return;
        }

        for (const item of results) {
          yield* Console.log(
            `${icons.folder} ${bold(item.context)}  ${dim(`(${item.count} secrets)`)}`
          );
        }
        return;
      }

      const results = yield* SecretStore.search(context.value, pattern);

      if (jsonMode) {
        yield* Console.log(JSON.stringify(results));
        return;
      }

      if (results.length === 0) {
        yield* Console.log(`${icons.search} No secrets found.`);
        return;
      }

      for (const item of results) {
        yield* Console.log(`${icons.key} ${item.key}`);
      }
    })
);
