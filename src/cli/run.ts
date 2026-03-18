import { execSync } from "node:child_process";
import { Args, Command } from "@effect/cli";
import { Effect } from "effect";
import { SecretStore } from "../services/secret-store.js";
import { rootCommand } from "./root.js";

const cmd = Args.text({ name: "command" }).pipe(
  Args.withDescription(
    "Command to execute. Use {key} placeholders for secret interpolation"
  )
);

export const runCommand = Command.make("run", { cmd }, ({ cmd }) =>
  Effect.gen(function* () {
    const { env } = yield* rootCommand;

    // Find all {key} placeholders
    const placeholders = [...cmd.matchAll(/\{([^}]+)\}/g)];

    let resolved = cmd;
    for (const match of placeholders) {
      const key = match[1];
      if (key === undefined) {
        continue;
      }
      const value = yield* SecretStore.get(env, key);
      resolved = resolved.replaceAll(`{${key}}`, String(value));
    }

    if (placeholders.length > 0) {
      yield* Effect.log(`Resolved ${placeholders.length} secret(s)`);
    }

    try {
      execSync(resolved, {
        stdio: "inherit",
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
      });
    } catch (e: unknown) {
      const status =
        e instanceof Error && "status" in e
          ? (e as { status: number }).status
          : 1;
      yield* Effect.fail(new Error(`Command exited with code ${status}`));
    }
  })
);
