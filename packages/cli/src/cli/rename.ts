import { bold, icons, SecretStore } from "@envsec/core";
import { Console, Effect } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/cli";

import { isJsonOutput, requireContext } from "./root.js";

const oldKeyArg = Args.String("old-key");
const newKeyArg = Args.String("new-key");

const forceOption = Options.Boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite target if it already exists"),
  Options.withDefault(false)
);

export const renameCommand = Command.make(
  "rename",
  // oxlint-disable-next-line sort-keys -- key order sets the positional argument order
  { oldKey: oldKeyArg, newKey: newKeyArg, force: forceOption },
  ({ oldKey, newKey, force }) =>
    Effect.gen(function* renameHandler() {
      const ctx = yield* requireContext;
      const jsonMode = yield* isJsonOutput;

      if (oldKey === newKey) {
        yield* Effect.fail(
          new Error("Source and target keys are the same — nothing to rename")
        );
        return;
      }

      const value = yield* SecretStore.get(ctx, oldKey);
      const meta = yield* SecretStore.getMetadata(ctx, oldKey);

      if (!force) {
        yield* SecretStore.getMetadata(ctx, newKey).pipe(
          Effect.flatMap(() =>
            Effect.fail(
              new Error(
                `Secret "${newKey}" already exists in context "${ctx}". Use --force to overwrite.`
              )
            )
          ),
          Effect.catchTag("SecretNotFoundError", () => Effect.void)
        );
      }

      yield* SecretStore.withBatch(
        SecretStore.set(ctx, newKey, value, meta.expires_at).pipe(
          Effect.andThen(SecretStore.remove(ctx, oldKey))
        )
      );

      yield* Console.log(
        jsonMode
          ? JSON.stringify({
              action: "rename",
              context: ctx,
              from: oldKey,
              to: newKey,
            })
          : `${icons.success} Renamed ${bold(`"${oldKey}"`)} ${icons.arrow} ${bold(`"${newKey}"`)} in context ${bold(`"${ctx}"`)}`
      );
    })
).pipe(Command.withDescription("Rename a secret within a context"));
