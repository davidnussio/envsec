import { writeFileSync } from "node:fs";
import path from "node:path";

import { badge, bold, FileAccessError, icons, SecretStore } from "@envsec/core";
import { Console, Effect } from "effect";
import { Command, Flag as Options } from "effect/cli";

import { requireContext } from "./root.js";

const outputOption = Options.String("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("Output file path (default: .env)"),
  Options.withDefault(".env")
);

export const envFileCommand = Command.make(
  "env-file",
  { output: outputOption },
  ({ output }) =>
    Effect.gen(function* envFileHandler() {
      const ctx = yield* requireContext;

      const secrets = yield* SecretStore.list(ctx);

      if (secrets.length === 0) {
        yield* Console.log(
          `${icons.empty} No secrets found for context ${bold(`"${ctx}"`)}`
        );
        return;
      }

      const results = yield* Effect.forEach(
        secrets,
        (item) =>
          SecretStore.get(ctx, item.key).pipe(
            Effect.map((value) => ({
              found: true as const,
              key: item.key,
              value: String(value),
            })),
            Effect.catchTag("SecretNotFoundError", () =>
              Effect.succeed({
                found: false as const,
                key: item.key,
                value: "",
              })
            )
          ),
        { concurrency: 10 }
      );

      const lines: string[] = [];
      const skipped: string[] = [];
      for (const result of results) {
        if (!result.found) {
          skipped.push(result.key);
          continue;
        }
        const envKey = result.key.toUpperCase().replaceAll(".", "_");
        const escaped = result.value
          .replaceAll("\\", "\\\\")
          .replaceAll('"', '\\"')
          .replaceAll("\n", "\\n");
        lines.push(`${envKey}="${escaped}"`);
      }

      if (skipped.length > 0) {
        yield* Console.log(
          `${icons.warning} Skipped ${badge(skipped.length, "secret")} no longer in keychain: ${skipped.join(", ")}`
        );
      }

      yield* Effect.try({
        catch: (error) =>
          new FileAccessError({
            cause: error,
            message: `Failed to write env file: ${error}`,
            path: output,
          }),
        try: () => writeFileSync(output, `${lines.join("\n")}\n`, "utf-8"),
      });

      const absolutePath = path.resolve(output);
      yield* SecretStore.trackEnvFileExport(ctx, absolutePath);

      yield* Console.log(
        `${icons.file} Written ${badge(lines.length, "secret")} to ${bold(output)}`
      );
    })
).pipe(
  Command.withDescription("Write the secrets of a context to a .env file")
);
