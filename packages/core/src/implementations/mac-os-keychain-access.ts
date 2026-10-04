import { execFile } from "node:child_process";

import { Effect, Layer } from "effect";

import { KeychainError, SecretNotFoundError } from "../errors.js";
import { KeychainAccess } from "../services/keychain-access.js";

const run = (args: string[]) =>
  Effect.callback<
    { exitCode: number; stdout: string; stderr: string },
    KeychainError
  >((resume, signal) => {
    // `signal` aborts on fiber interruption, which kills the child process.
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Effect.callback bridges execFile's callback API; the AbortSignal kills the child on interruption
    execFile("security", args, { signal }, (error, stdout, stderr) => {
      if (error && typeof error.code === "string") {
        resume(
          Effect.fail(
            new KeychainError({
              cause: error,
              command: args[0] ?? "unknown",
              message: "Failed to run security command",
              stderr: String(error),
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
          stderr,
          stdout,
        })
      );
    });
  }).pipe(
    // Never log the arguments: they contain the secret value.
    Effect.tap((result) =>
      Effect.logDebug(`security ${args[0]} exited with ${result.exitCode}`)
    )
  );

const make = KeychainAccess.of({
  get: Effect.fn("MacOsKeychainAccess.get")(function* get(
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
        context: service,
        key: account,
        message: `Secret not found: ${service}/${account}`,
      });
    }

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "find-generic-password",
        message: `Failed to get keychain item: ${service}/${account}`,
        stderr: result.stderr,
      });
    }

    return result.stdout.trim();
  }),

  remove: Effect.fn("MacOsKeychainAccess.remove")(function* remove(
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
        message: `Failed to remove keychain item: ${service}/${account}`,
        stderr: result.stderr,
      });
    }
  }),

  set: Effect.fn("MacOsKeychainAccess.set")(function* set(
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
        message: `Failed to set keychain item: ${service}/${account}`,
        stderr: result.stderr,
      });
    }
  }),
});

export const MacOsKeychainAccessLive = Layer.succeed(KeychainAccess, make);
