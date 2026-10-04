import { readFileSync } from "node:fs";
import { bold, FileAccessError, icons, SecretStore } from "@envsec/core";
import { Console, Effect } from "effect";
import { Command, Flag as Options } from "effect/cli";
import { requireContext } from "./root.js";

const input = Options.String("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("Input .env file path (default: .env)"),
  Options.withDefault(".env")
);

const force = Options.Boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite existing secrets without prompting"),
  Options.withDefault(false)
);

const batch = Options.Boolean("batch").pipe(
  Options.withAlias("b"),
  Options.withDescription(
    "Batch mode: defer database persistence until all secrets are imported"
  ),
  Options.withDefault(false)
);

const parseLine = (line: string): { key: string; value: string } | null => {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return null;
  }
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) {
    return null;
  }
  const key = trimmed.slice(0, eqIndex).trim();
  const value = trimmed
    .slice(eqIndex + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  return { key, value };
};

export const loadCommand = Command.make(
  "load",
  { input, force, batch },
  ({ input, force, batch }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;

      const content = yield* Effect.try({
        try: () => readFileSync(input, "utf-8"),
        catch: () =>
          new FileAccessError({
            path: input,
            message: `Cannot read file: ${input}`,
          }),
      });

      const lines = content.split("\n");
      let added = 0;
      let skipped = 0;
      let overwritten = 0;

      const existingSecrets = yield* SecretStore.list(ctx);
      const existingKeys = new Set(existingSecrets.map((item) => item.key));

      const importAll = Effect.gen(function* () {
        for (const line of lines) {
          const parsed = parseLine(line);
          if (!parsed) {
            continue;
          }

          const secretKey = parsed.key.toLowerCase().replaceAll("_", ".");

          const exists = existingKeys.has(secretKey);

          if (exists && !force) {
            yield* Console.log(
              `${icons.warning} Skipped ${bold(`"${secretKey}"`)}: already exists (use --force to overwrite)`
            );
            skipped++;
            continue;
          }

          if (exists) {
            overwritten++;
          } else {
            added++;
          }

          yield* SecretStore.set(ctx, secretKey, parsed.value);
          existingKeys.add(secretKey);
        }
      });

      yield* batch ? SecretStore.withBatch(importAll) : importAll;

      yield* Console.log(
        `${icons.success} Done: ${bold(String(added))} added, ${bold(String(overwritten))} overwritten, ${bold(String(skipped))} skipped`
      );
    })
);
