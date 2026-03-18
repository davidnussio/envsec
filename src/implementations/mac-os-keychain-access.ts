import { execFile } from "node:child_process";
import { Effect, Layer } from "effect";
import { KeychainError, SecretNotFoundError } from "../errors.js";
import { KeychainAccess } from "../services/keychain-access.js";

const run = (args: string[]) =>
  Effect.async<
    { exitCode: number; stdout: string; stderr: string },
    KeychainError
  >((resume) => {
    execFile("security", args, (error, stdout, stderr) => {
      if (error && typeof error.code === "string") {
        resume(
          Effect.fail(
            new KeychainError({
              command: args[0] ?? "unknown",
              stderr: String(error),
              message: "Failed to run security command",
            })
          )
        );
        return;
      }
      let exitCode = 0;
      if (error) {
        exitCode = typeof error.code === "number" ? error.code : 1;
      }
      resume(
        Effect.succeed({
          exitCode,
          stdout,
          stderr,
        })
      );
    });
  });

const make = KeychainAccess.of({
  set: Effect.fn("MacOsKeychainAccess.set")(function* (
    service: string,
    account: string,
    password: string
  ) {
    const result = yield* run([
      "add-generic-password",
      "-U",
      "-s",
      service,
      "-a",
      account,
      "-w",
      password,
    ]);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "add-generic-password",
        stderr: result.stderr,
        message: `Failed to set keychain item: ${service}/${account}`,
      });
    }
  }),

  get: Effect.fn("MacOsKeychainAccess.get")(function* (
    service: string,
    account: string
  ) {
    const result = yield* run([
      "find-generic-password",
      "-s",
      service,
      "-a",
      account,
      "-w",
    ]);

    if (result.exitCode === 44) {
      return yield* new SecretNotFoundError({
        key: account,
        context: service,
        message: `Secret not found: ${service}/${account}`,
      });
    }

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "find-generic-password",
        stderr: result.stderr,
        message: `Failed to get keychain item: ${service}/${account}`,
      });
    }

    return result.stdout.trim();
  }),

  remove: Effect.fn("MacOsKeychainAccess.remove")(function* (
    service: string,
    account: string
  ) {
    const result = yield* run([
      "delete-generic-password",
      "-s",
      service,
      "-a",
      account,
    ]);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "delete-generic-password",
        stderr: result.stderr,
        message: `Failed to remove keychain item: ${service}/${account}`,
      });
    }
  }),
});

export const MacOsKeychainAccessLive = Layer.succeed(KeychainAccess, make);
