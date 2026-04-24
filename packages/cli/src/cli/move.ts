import { Args, Command, Options } from "@effect/cli";
import { badge, bold, icons, SecretStore } from "@envsec/core";
import { Console, Effect } from "effect";
import { checkConflicts, resolveKeys } from "./bulk-ops.js";
import { readConfirmation } from "./prompts.js";
import { isJsonOutput, requireContext } from "./root.js";

const pattern = Args.text({ name: "pattern" }).pipe(Args.optional);

const to = Options.text("to").pipe(
  Options.withAlias("t"),
  Options.withDescription("Target context to move secrets to")
);

const all = Options.boolean("all").pipe(
  Options.withDescription("Move all secrets from source context"),
  Options.withDefault(false)
);

const force = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite target secrets if they already exist"),
  Options.withDefault(false)
);

const yes = Options.boolean("yes").pipe(
  Options.withAlias("y"),
  Options.withDescription("Skip confirmation prompt"),
  Options.withDefault(false)
);

export const moveCommand = Command.make(
  "move",
  { pattern, to, all, force, yes },
  ({ pattern, to, all, force, yes }) =>
    Effect.gen(function* () {
      const sourceCtx = yield* requireContext;
      const jsonMode = yield* isJsonOutput;

      if (sourceCtx === to) {
        return yield* Effect.fail(
          new Error(
            "Source and target contexts are the same. Use 'rename' to rename secrets within a context."
          )
        );
      }

      const keys = yield* resolveKeys(sourceCtx, pattern, all, "move");

      if (keys.length === 0) {
        yield* Console.log(
          `${icons.empty} No secrets matched in context ${bold(`"${sourceCtx}"`)}.`
        );
        return;
      }

      if (keys.length > 1 && !yes) {
        const confirmed = yield* readConfirmation(
          `${icons.warning} Move ${badge(keys.length, "secret")} from ${bold(`"${sourceCtx}"`)} to ${bold(`"${to}"`)}?`
        );
        if (!confirmed) {
          yield* Console.log(`${icons.cancel} Cancelled.`);
          return;
        }
      }

      if (!force) {
        yield* checkConflicts(to, keys);
      }

      yield* SecretStore.beginBatch();
      let moved = 0;
      for (const key of keys) {
        const value = yield* SecretStore.get(sourceCtx, key);
        const meta = yield* SecretStore.getMetadata(sourceCtx, key);
        yield* SecretStore.set(to, key, value, meta.expires_at);
        yield* SecretStore.remove(sourceCtx, key);
        moved++;
      }
      yield* SecretStore.endBatch();

      if (jsonMode) {
        yield* Console.log(
          JSON.stringify({
            action: "move",
            from: sourceCtx,
            to,
            keys,
            count: moved,
          })
        );
      } else {
        yield* Console.log(
          `${icons.success} Moved ${badge(moved, "secret")} from ${bold(`"${sourceCtx}"`)} ${icons.arrow} ${bold(`"${to}"`)}`
        );
      }
    })
);
