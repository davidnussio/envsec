import { badge, bold, icons, SecretStore } from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/cli";

import { readConfirmation } from "./prompt.js";
import { requireContext } from "./root.js";

const keyArg = Args.String("key").pipe(Args.optional);

const yesOption = Options.Boolean("yes").pipe(
  Options.withAlias("y"),
  Options.withDescription("Skip confirmation prompt"),
  Options.withDefault(false)
);

const allOption = Options.Boolean("all").pipe(
  Options.withDescription("Delete all secrets in the context"),
  Options.withDefault(false)
);

const handler = Effect.fn("handler")(function* handler({
  key,
  yes,
  all,
}: {
  key: Option.Option<string>;
  yes: boolean;
  all: boolean;
}) {
  const ctx = yield* requireContext;

  if (all) {
    const keys = yield* SecretStore.list(ctx);

    if (keys.length === 0) {
      yield* Console.log(
        `${icons.empty} No secrets found in context ${bold(`"${ctx}"`)}.`
      );
      return;
    }

    if (!yes) {
      const confirmed = yield* readConfirmation(
        `${icons.warning} Delete ${badge(keys.length, "secret")} from context ${bold(`"${ctx}"`)}?`
      );
      if (!confirmed) {
        yield* Console.log(`${icons.cancel} Cancelled.`);
        return;
      }
    }

    yield* SecretStore.withBatch(
      Effect.forEach(keys, (k) => SecretStore.remove(ctx, k.key), {
        concurrency: 1,
        discard: true,
      })
    );
    yield* Console.log(
      `${icons.trash} Removed ${badge(keys.length, "secret")} from context ${bold(`"${ctx}"`)}`
    );
    return;
  }

  if (Option.isNone(key)) {
    yield* Effect.fail(
      new Error("Provide a <key> argument or use --all to delete everything")
    );
    return;
  }

  const keyValue = key.value;

  if (!yes) {
    const confirmed = yield* readConfirmation(
      `${icons.warning} Delete secret ${bold(`"${keyValue}"`)} from context ${bold(`"${ctx}"`)}?`
    );
    if (!confirmed) {
      yield* Console.log(`${icons.cancel} Cancelled.`);
      return;
    }
  }

  yield* SecretStore.remove(ctx, keyValue);
  yield* Console.log(
    `${icons.trash} Secret ${bold(`"${keyValue}"`)} removed from context ${bold(`"${ctx}"`)}`
  );
});

export const deleteCommand = Command.make(
  "delete",
  // oxlint-disable-next-line sort-keys -- key order sets the argument/flag order in --help
  { key: keyArg, yes: yesOption, all: allOption },
  handler
).pipe(
  Command.withDescription("Delete a secret, or every secret with --all"),
  Command.withAlias("del")
);
