import { writeFileSync } from "node:fs";
import { Command, Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

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
      const { context } = yield* rootCommand;

      if (Option.isNone(context)) {
        return yield* Effect.fail(
          new Error("Missing required option --context (-c)")
        );
      }
      const ctx = context.value;

      const secrets = yield* SecretStore.list(ctx);

      if (secrets.length === 0) {
        yield* Console.log(`No secrets found for context "${ctx}"`);
        return;
      }

      const lines: string[] = [];
      for (const item of secrets) {
        const value = yield* SecretStore.get(ctx, item.key);
        const envKey = item.key.toUpperCase().replaceAll(".", "_");
        lines.push(`${envKey}=${String(value)}`);
      }

      writeFileSync(output, `${lines.join("\n")}\n`, "utf-8");
      yield* Console.log(`Written ${secrets.length} secret(s) to ${output}`);
    })
);
