import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";
import { FileAccessError, SecretStore, type SecretNotFoundError, badge, bold, icons } from "@envsec/core";
import { requireContext } from "./root.js";

const output = Options.text("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("Output file path (default: .env)"),
  Options.withDefault(".env")
);

export const envFileCommand = Command.make(
  "env-file",
  { output },
  ({ output }) =>
    Effect.gen(function* () {
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
              key: item.key,
              found: true as const,
              value: String(value),
            })),
            Effect.catchTag("SecretNotFoundError", (_: SecretNotFoundError) =>
              Effect.succeed({
                key: item.key,
                found: false as const,
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
        try: () => writeFileSync(output, `${lines.join("\n")}\n`, "utf-8"),
        catch: (error) =>
          new FileAccessError({
            path: output,
            message: `Failed to write env file: ${error}`,
          }),
      });

      const absolutePath = resolve(output);
      yield* SecretStore.trackEnvFileExport(ctx, absolutePath);

      yield* Console.log(
        `${icons.file} Written ${badge(lines.length, "secret")} to ${bold(output)}`
      );
    })
);
