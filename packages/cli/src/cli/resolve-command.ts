import {
  badge,
  icons,
  indent,
  MissingSecretsError,
  SecretStore,
  stderrUi,
} from "@envsec/core";
import type { SecretNotFoundError } from "@envsec/core";
import { Console, Effect } from "effect";

const placeholderPattern = /(?<!\$)\{(?<key>[^}]+)\}/gu;

export interface ResolvedCommand {
  readonly command: string;
  readonly env: Record<string, string>;
}

const toEnvVarName = (key: string, index: number): string =>
  `ENVSEC_${index}_${key.replaceAll(/[^a-zA-Z0-9]/gu, "_").toUpperCase()}`;

export const resolveCommand = Effect.fn("resolveCommand")(
  function* resolveCommand(
    cmd: string,
    ctx: string,
    options?: { quiet?: boolean }
  ) {
    const placeholders = [...cmd.matchAll(placeholderPattern)];

    if (placeholders.length === 0) {
      return { command: cmd, env: {} };
    }

    const missing: string[] = [];
    let resolved = cmd;
    const env: Record<string, string> = {};

    for (const [index, match] of placeholders.entries()) {
      const key = match.groups?.key;
      if (key === undefined) {
        continue;
      }

      const result = yield* SecretStore.get(ctx, key).pipe(
        Effect.map((value) => ({ found: true as const, value: String(value) })),
        Effect.catchTag("SecretNotFoundError", (e: SecretNotFoundError) =>
          Effect.succeed({ found: false as const, key: e.key })
        )
      );

      if (result.found) {
        const envVar = toEnvVarName(key, index);
        env[envVar] = result.value;
        const shellRef =
          process.platform === "win32" ? `%${envVar}%` : `$${envVar}`;
        resolved = resolved.replaceAll(`{${key}}`, shellRef);
      } else {
        missing.push(result.key);
      }
    }

    if (missing.length > 0) {
      const keyList = missing.map((k) => indent(`- ${k}`)).join("\n");
      const message = `Missing secrets in context "${ctx}":\n${keyList}\n\nAdd them with: envsec -c ${ctx} add <key>`;
      yield* Console.error(`${stderrUi.icons.error} ${message}`);
      return yield* new MissingSecretsError({
        context: ctx,
        keys: missing,
        message,
      });
    }

    yield* options?.quiet
      ? Effect.void
      : Console.log(
          `${icons.lock} Resolved ${badge(placeholders.length, "secret")}`
        );
    return { command: resolved, env };
  }
);
