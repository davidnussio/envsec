import { readFileSync } from "node:fs";
import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const input = Options.text("input").pipe(
  Options.withAlias("i"),
  Options.withDescription("Input .env file path (default: .env)"),
  Options.withDefault(".env")
);

const force = Options.boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription("Overwrite existing secrets without prompting")
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
  { input, force },
  ({ input, force }) =>
    Effect.gen(function* () {
      const { env } = yield* rootCommand;

      const content = yield* Effect.try({
        try: () => readFileSync(input, "utf-8"),
        catch: () => new Error(`Cannot read file: ${input}`),
      });

      const lines = content.split("\n");
      let added = 0;
      let skipped = 0;
      let overwritten = 0;

      for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) {
          continue;
        }

        const secretKey = parsed.key.toLowerCase().replaceAll("_", ".");

        const exists = yield* SecretStore.list(env).pipe(
          Effect.map((items) => items.some((item) => item.key === secretKey))
        );

        if (exists && !force) {
          yield* Console.log(
            `⚠ Skipped "${secretKey}": already exists (use --force to overwrite)`
          );
          skipped++;
          continue;
        }

        if (exists) {
          overwritten++;
        } else {
          added++;
        }

        yield* SecretStore.set(env, secretKey, parsed.value, "string");
      }

      yield* Effect.log(
        `Done: ${added} added, ${overwritten} overwritten, ${skipped} skipped`
      );
    })
);
