import { badge, bold, icons, SecretStore } from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/cli";

import { readConfirmation } from "./prompt.js";
import { isJsonOutput, requireContext } from "./root.js";

const patternArg = Args.String("pattern").pipe(Args.optional);

const toOption = Options.String("to").pipe(
  Options.withAlias("t"),
  Options.withDescription("Target context to copy secrets to")
);

const allOption = Options.Boolean("all").pipe(
  Options.withDescription("Copy all secrets from source context"),
  Options.withDefault(false)
);

const forceOption = Options.Boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite target secrets if they already exist"),
  Options.withDefault(false)
);

const yesOption = Options.Boolean("yes").pipe(
  Options.withAlias("y"),
  Options.withDescription("Skip confirmation prompt"),
  Options.withDefault(false)
);

/** Convert a glob pattern (with * and ?) to a RegExp */
const globToRegex = (pat: string): RegExp => {
  const escaped = pat.replaceAll(/[.+^${}()|[\]\\]/gu, "\\$&");
  const withWildcards = escaped.replaceAll("*", ".*").replaceAll("?", ".");
  return new RegExp(`^${withWildcards}$`, "u");
};

/** Resolve which keys to operate on based on --all flag or glob pattern */
const resolveKeys = Effect.fn("resolveKeys")(function* resolveKeys(
  sourceCtx: string,
  pat: Option.Option<string>,
  useAll: boolean
) {
  if (useAll) {
    const items = yield* SecretStore.list(sourceCtx);
    return items.map((i) => i.key);
  }
  if (Option.isNone(pat)) {
    return yield* Effect.fail(
      new Error("Provide a <pattern> argument or use --all to copy everything")
    );
  }
  const p = pat.value;
  if (p.includes("*") || p.includes("?")) {
    const items = yield* SecretStore.list(sourceCtx);
    const regex = globToRegex(p);
    return items.filter((i) => regex.test(i.key)).map((i) => i.key);
  }
  return [p];
});

/** Check for conflicts in target context */
const checkConflicts = Effect.fn("checkConflicts")(function* checkConflicts(
  targetCtx: string,
  keys: string[]
) {
  const targetItems = yield* SecretStore.list(targetCtx).pipe(
    Effect.catchTag("MetadataStoreError", () => Effect.succeed([]))
  );
  const targetKeys = new Set(targetItems.map((i) => i.key));
  const conflicts = keys.filter((k) => targetKeys.has(k));
  if (conflicts.length > 0) {
    yield* Effect.fail(
      new Error(
        `Target context "${targetCtx}" already has: ${conflicts.join(", ")}. Use --force to overwrite.`
      )
    );
  }
});

export const copyCommand = Command.make(
  "copy",
  // oxlint-disable-next-line sort-keys -- key order sets the argument/flag order in --help
  {
    pattern: patternArg,
    to: toOption,
    all: allOption,
    force: forceOption,
    yes: yesOption,
  },
  ({ pattern, to, all, force, yes }) =>
    Effect.gen(function* copyHandler() {
      const sourceCtx = yield* requireContext;
      const jsonMode = yield* isJsonOutput;

      if (sourceCtx === to) {
        return yield* Effect.fail(
          new Error(
            "Source and target contexts are the same. Use 'rename' to rename secrets within a context."
          )
        );
      }

      const keys = yield* resolveKeys(sourceCtx, pattern, all);

      if (keys.length === 0) {
        yield* Console.log(
          `${icons.empty} No secrets matched in context ${bold(`"${sourceCtx}"`)}.`
        );
        return;
      }

      if (keys.length > 1 && !yes) {
        const confirmed = yield* readConfirmation(
          `${icons.warning} Copy ${badge(keys.length, "secret")} from ${bold(`"${sourceCtx}"`)} to ${bold(`"${to}"`)}?`
        );
        if (!confirmed) {
          yield* Console.log(`${icons.cancel} Cancelled.`);
          return;
        }
      }

      if (!force) {
        yield* checkConflicts(to, keys);
      }

      let copied = 0;
      yield* SecretStore.withBatch(
        Effect.gen(function* copyKeys() {
          for (const key of keys) {
            const value = yield* SecretStore.get(sourceCtx, key);
            const meta = yield* SecretStore.getMetadata(sourceCtx, key);
            yield* SecretStore.set(to, key, value, meta.expires_at);
            copied += 1;
          }
        })
      );

      // oxlint-disable-next-line sort-keys -- key order is part of the --json output
      const summary = {
        action: "copy",
        from: sourceCtx,
        to,
        keys,
        count: copied,
      };
      yield* Console.log(
        jsonMode
          ? JSON.stringify(summary)
          : `${icons.success} Copied ${badge(copied, "secret")} from ${bold(`"${sourceCtx}"`)} ${icons.arrow} ${bold(`"${to}"`)}`
      );
    })
).pipe(Command.withDescription("Copy secrets to another context"));
