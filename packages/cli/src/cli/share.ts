import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import {
  FileAccessError,
  GPGEncryptionError,
  SecretStore,
  stderrUi,
} from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { Command, Flag as Options } from "effect/cli";

import { isJsonOutput, requireContext } from "./root.js";

const encryptToOption = Options.String("encrypt-to").pipe(
  Options.withDescription(
    "GPG recipient key (email, key ID, or fingerprint) to encrypt for"
  )
);

const outputOption = Options.String("output").pipe(
  Options.withAlias("o"),
  Options.withDescription(
    "Output file path (default: stdout). Use - for stdout explicitly"
  ),
  Options.optional
);

const gpgEncrypt = (
  plaintext: string,
  recipient: string
): Effect.Effect<string, GPGEncryptionError> =>
  Effect.try({
    catch: (e) =>
      new GPGEncryptionError({
        cause: e,
        message: `GPG encryption failed: ${e instanceof Error ? e.message : String(e)}`,
        recipient,
      }),
    try: () =>
      execFileSync(
        "gpg",
        [
          "--batch",
          "--yes",
          "--trust-model",
          "always",
          "--encrypt",
          "--armor",
          "--recipient",
          recipient,
        ],
        { encoding: "utf-8", input: plaintext, stdio: ["pipe", "pipe", "pipe"] }
      ),
  });

export const shareCommand = Command.make(
  "share",
  { encryptTo: encryptToOption, output: outputOption },
  ({ encryptTo, output }) =>
    Effect.gen(function* shareHandler() {
      const ctx = yield* requireContext;
      const jsonOutput = yield* isJsonOutput;
      const secrets = yield* SecretStore.list(ctx);

      if (secrets.length === 0) {
        yield* Console.error(
          `${stderrUi.icons.empty} No secrets found for context ${stderrUi.bold(`"${ctx}"`)}`
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

      const skipped: string[] = [];
      const entries: { key: string; value: string }[] = [];
      for (const result of results) {
        if (!result.found) {
          skipped.push(result.key);
          continue;
        }
        entries.push({ key: result.key, value: result.value });
      }

      if (skipped.length > 0) {
        yield* Console.error(
          `${stderrUi.icons.warning} Skipped ${stderrUi.badge(skipped.length, "secret")} no longer in keychain: ${skipped.join(", ")}`
        );
      }

      const plaintext = jsonOutput
        ? JSON.stringify({ context: ctx, secrets: entries }, null, 2)
        : entries
            .map((e) => {
              const envKey = e.key.toUpperCase().replaceAll(".", "_");
              const escaped = e.value
                .replaceAll("\\", "\\\\")
                .replaceAll('"', '\\"')
                .replaceAll("\n", "\\n");
              return `${envKey}="${escaped}"`;
            })
            .join("\n");

      const encrypted = yield* gpgEncrypt(plaintext, encryptTo);

      if (Option.isSome(output) && output.value !== "-") {
        yield* Effect.try({
          catch: (error) =>
            new FileAccessError({
              cause: error,
              message: `Failed to write share file: ${error}`,
              path: output.value,
            }),
          try: () => writeFileSync(output.value, encrypted, "utf-8"),
        });
        yield* Console.error(
          `${stderrUi.icons.shield} Encrypted ${stderrUi.badge(entries.length, "secret")} from ${stderrUi.bold(`"${ctx}"`)} for ${stderrUi.bold(encryptTo)} ${stderrUi.icons.arrow} ${stderrUi.bold(output.value)}`
        );
      } else {
        yield* Console.log(encrypted);
      }
    })
).pipe(
  Command.withDescription(
    "Encrypt the secrets of a context for someone with GPG"
  )
);
