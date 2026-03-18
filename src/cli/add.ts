import { Args, Command, Options } from "@effect/cli";
import { Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const key = Args.text({ name: "key" });
const valueOption = Options.text("value").pipe(
  Options.withAlias("v"),
  Options.withDescription("Value to store (omit for interactive prompt)"),
  Options.optional
);

const readSecret = (prompt: string): Effect.Effect<string, Error> =>
  Effect.async((resume) => {
    process.stdout.write(prompt);

    const wasRaw = process.stdin.isRaw;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    let input = "";

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
      process.stdin.pause();
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          resume(Effect.succeed(input));
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          resume(Effect.fail(new Error("Aborted")));
          return;
        }
        if (ch === "\u007F" || ch === "\b") {
          input = input.slice(0, -1);
        } else {
          input += ch;
        }
      }
    };

    process.stdin.on("data", onData);
  });

export const addCommand = Command.make(
  "add",
  { key, value: valueOption },
  ({ key, value }) =>
    Effect.gen(function* () {
      const { env } = yield* rootCommand;

      const secret = Option.isSome(value)
        ? value.value
        : yield* readSecret("Enter secret value: ");

      if (secret.trim() === "") {
        return yield* Effect.fail(new Error("Secret value cannot be empty"));
      }

      yield* SecretStore.set(env, key, secret);
      yield* Effect.log(`Secret "${key}" stored in env "${env}"`);
    })
);
