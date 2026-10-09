import { badge, bold, icons, SecretStore } from "@envsec/core";
import { Console, Effect } from "effect";
import { Command, Flag as Options } from "effect/cli";

import { formatExport, formatUnset } from "../shell-export.js";
import type { Shell } from "../shell-export.js";
import { requireContext } from "./root.js";

const shellOption = Options.Literals("shell", [
  "bash",
  "zsh",
  "fish",
  "powershell",
]).pipe(
  Options.withAlias("s"),
  Options.withDescription("Target shell syntax (default: bash)"),
  Options.withDefault("bash" as Shell)
);

const unsetOption = Options.Boolean("unset").pipe(
  Options.withAlias("u"),
  Options.withDescription("Output unset/remove commands instead of export"),
  Options.withDefault(false)
);

const toEnvKey = (key: string): string =>
  key.toUpperCase().replaceAll(".", "_");

export const envCommand = Command.make(
  "env",
  { shell: shellOption, unset: unsetOption },
  ({ shell, unset }) =>
    Effect.gen(function* envHandler() {
      const ctx = yield* requireContext;
      const secrets = yield* SecretStore.list(ctx);

      if (secrets.length === 0) {
        yield* Console.error(
          `${icons.empty} No secrets found for context ${bold(`"${ctx}"`)}`
        );
        return;
      }

      if (unset) {
        for (const item of secrets) {
          const envKey = toEnvKey(item.key);
          yield* Console.log(formatUnset(envKey, shell));
        }
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

      const skipped: string[] = [];
      for (const result of results) {
        if (!result.found) {
          skipped.push(result.key);
          continue;
        }
        const envKey = toEnvKey(result.key);
        yield* Console.log(formatExport(envKey, result.value, shell));
      }

      if (skipped.length > 0) {
        yield* Console.error(
          `${icons.warning} Skipped ${badge(skipped.length, "secret")} no longer in keychain: ${skipped.join(", ")}`
        );
      }
    })
).pipe(
  Command.withDescription("Print shell export statements for the secrets")
);
