import { Args, Command, Options } from "@effect/cli";
import { Effect, Option } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const key = Args.text({ name: "key" });
const wordOption = Options.text("word").pipe(
  Options.withAlias("w"),
  Options.withDescription("String value to store"),
  Options.optional
);
const digitOption = Options.text("digit").pipe(
  Options.withAlias("d"),
  Options.withDescription("Number value to store"),
  Options.optional
);
const boolOption = Options.boolean("bool").pipe(
  Options.withAlias("b"),
  Options.withDescription("Boolean flag to store (presence = true)")
);

const readSecret = (prompt: string): Effect.Effect<string, Error> =>
  Effect.async((resume) => {
    process.stdout.write(prompt);

    const _wasPaused = process.stdin.isPaused();
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
  { key, word: wordOption, digit: digitOption, bool: boolOption },
  ({ key, word, digit, bool }) =>
    Effect.gen(function* () {
      const { env } = yield* rootCommand;

      if (Option.isSome(word)) {
        yield* SecretStore.set(env, key, word.value, "string");
      } else if (Option.isSome(digit)) {
        const num = Number(digit.value);
        if (Number.isNaN(num)) {
          return yield* Effect.fail(
            new Error(`Invalid number: ${digit.value}`)
          );
        }
        yield* SecretStore.set(env, key, digit.value, "number");
      } else if (bool) {
        yield* SecretStore.set(env, key, "true", "boolean");
      } else {
        const value = yield* readSecret("Enter secret value: ");
        if (value.trim() === "") {
          return yield* Effect.fail(new Error("Secret value cannot be empty"));
        }
        yield* SecretStore.set(env, key, value, "string");
      }

      yield* Effect.log(`Secret "${key}" stored in env "${env}"`);
    })
);
