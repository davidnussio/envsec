import { readFileSync } from "node:fs";

import { bold, FileAccessError, icons, SecretStore } from "@envsec/core";
import { Console, Effect } from "effect";
import { Command, Flag as Options } from "effect/cli";

import { parseDotenv, toSecretKey } from "../dotenv.js";
import { requireContext } from "./root.js";

const inputOption = Options.String("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("Input .env file path (default: .env)"),
  Options.withDefault(".env")
);

const forceOption = Options.Boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite existing secrets without prompting"),
  Options.withDefault(false)
);

const batchOption = Options.Boolean("batch").pipe(
  Options.withAlias("b"),
  Options.withDescription(
    "Batch mode: defer database persistence until all secrets are imported"
  ),
  Options.withDefault(false)
);

export const loadCommand = Command.make(
  "load",
  // oxlint-disable-next-line sort-keys -- key order sets the flag order in --help
  { input: inputOption, force: forceOption, batch: batchOption },
  ({ input, force, batch }) =>
    Effect.gen(function* loadHandler() {
      const ctx = yield* requireContext;

      const content = yield* Effect.try({
        catch: () =>
          new FileAccessError({
            message: `Cannot read file: ${input}`,
            path: input,
          }),
        try: () => readFileSync(input, "utf-8"),
      });

      const entries = parseDotenv(content);
      let added = 0;
      let skipped = 0;
      let overwritten = 0;

      const existingSecrets = yield* SecretStore.list(ctx);
      const existingKeys = new Set(existingSecrets.map((item) => item.key));

      const importAll = Effect.gen(function* importAll() {
        for (const entry of entries) {
          const secretKey = toSecretKey(entry.name);

          const exists = existingKeys.has(secretKey);

          if (exists && !force) {
            yield* Console.log(
              `${icons.warning} Skipped ${bold(`"${secretKey}"`)}: already exists (use --force to overwrite)`
            );
            skipped += 1;
            continue;
          }

          if (exists) {
            overwritten += 1;
          } else {
            added += 1;
          }

          yield* SecretStore.set(ctx, secretKey, entry.value);
          existingKeys.add(secretKey);
        }
      });

      yield* batch ? SecretStore.withBatch(importAll) : importAll;

      yield* Console.log(
        `${icons.success} Done: ${bold(String(added))} added, ${bold(String(overwritten))} overwritten, ${bold(String(skipped))} skipped`
      );
    })
).pipe(Command.withDescription("Import secrets from a .env file"));
