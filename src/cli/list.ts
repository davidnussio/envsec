import { Command } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { optionalContext } from "./root.js";

export const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const context = yield* optionalContext;

    if (Option.isNone(context)) {
      const contexts = yield* SecretStore.listContexts();

      if (contexts.length === 0) {
        yield* Console.log("📭 No contexts found.");
        return;
      }

      for (const item of contexts) {
        yield* Console.log(`📦 ${item.context}  (${item.count} secrets)`);
      }
      return;
    }

    const results = yield* SecretStore.list(context.value);

    if (results.length === 0) {
      yield* Console.log("📭 No secrets found.");
      return;
    }

    for (const item of results) {
      yield* Console.log(`🔐 ${item.key}  updated: ${item.updated_at}`);
    }
  })
);
