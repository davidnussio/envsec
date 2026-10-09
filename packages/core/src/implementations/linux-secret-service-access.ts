import { execFile } from "node:child_process";

import { Effect, Layer } from "effect";

import { KeychainError, SecretNotFoundError } from "../errors.js";
import { KeychainAccess } from "../services/keychain-access.js";

/**
 * Linux implementation using `secret-tool` (libsecret).
 *
 * Stores secrets via the freedesktop.org Secret Service API (D-Bus),
 * backed by GNOME Keyring, KDE Wallet, or any compatible provider.
 *
 * Requires: `libsecret-tools` package
 *   - Debian/Ubuntu: sudo apt install libsecret-tools
 *   - Fedora:        sudo dnf install libsecret
 *   - Arch:          sudo pacman -S libsecret
 */

const ignoreStreamError = (): void => undefined;

const run = (args: string[], stdin?: string) =>
  Effect.callback<
    { exitCode: number; stdout: string; stderr: string },
    KeychainError
  >((resume, signal) => {
    // `signal` aborts on fiber interruption, which kills the child process.
    const child = execFile(
      "secret-tool",
      args,
      { signal },
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Effect.callback bridges execFile's callback API; the AbortSignal kills the child on interruption
      (error, stdout, stderr) => {
        if (error && "code" in error && error.code === "ENOENT") {
          resume(
            Effect.fail(
              new KeychainError({
                cause: error,
                command: args[0] ?? "unknown",
                message:
                  "secret-tool is not installed. Install it with your package manager (e.g. apt install libsecret-tools).",
                stderr: "secret-tool not found. Install libsecret-tools.",
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
      }
    );

    // secret-tool store reads the password from stdin
    if (stdin !== undefined) {
      // A child that exits without reading stdin (D-Bus error, locked
      // keyring, …) raises EPIPE here, which would crash the process with
      // no listener. Its exit status and stderr already report the failure.
      child.stdin?.on("error", ignoreStreamError);
      child.stdin?.end(stdin);
    }
  }).pipe(
    // Never log the stdin: it contains the secret value.
    Effect.tap((result) =>
      Effect.logDebug(`secret-tool ${args[0]} exited with ${result.exitCode}`)
    )
  );

const make = KeychainAccess.of({
  get: Effect.fn("LinuxSecretServiceAccess.get")(function* get(
    service: string,
    account: string
  ) {
    // secret-tool lookup <attribute> <value> ...
    const result = yield* run([
      "lookup",
      "service",
      service,
      "account",
      account,
    ]);

    // A missing item gives empty output and no diagnostics (exit 0 or 1,
    // depending on the libsecret version). Anything on stderr with a
    // non-zero exit (locked keyring, D-Bus unavailable, …) is a real error
    // and must not be reported as "not found".
    if (result.exitCode !== 0 && result.stderr.trim() !== "") {
      return yield* new KeychainError({
        command: "lookup",
        message: `Failed to read secret: ${service}/${account}`,
        stderr: result.stderr,
      });
    }

    if (result.stdout === "") {
      return yield* new SecretNotFoundError({
        context: service,
        key: account,
        message: `Secret not found: ${service}/${account}`,
      });
    }

    return result.stdout.trimEnd();
  }),

  remove: Effect.fn("LinuxSecretServiceAccess.remove")(function* remove(
    service: string,
    account: string
  ) {
    // secret-tool clear <attribute> <value> ...
    const result = yield* run([
      "clear",
      "service",
      service,
      "account",
      account,
    ]);

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "clear",
        message: `Failed to remove secret: ${service}/${account}`,
        stderr: result.stderr,
      });
    }
  }),

  set: Effect.fn("LinuxSecretServiceAccess.set")(function* set(
    service: string,
    account: string,
    password: string
  ) {
    // secret-tool store --label="<label>" <attribute> <value> ...
    // Password is read from stdin
    const result = yield* run(
      [
        "store",
        "--label",
        `envsec:${service}/${account}`,
        "service",
        service,
        "account",
        account,
      ],
      password
    );

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "store",
        message: `Failed to store secret: ${service}/${account}`,
        stderr: result.stderr,
      });
    }
  }),
});

export const LinuxSecretServiceAccessLive = Layer.succeed(KeychainAccess, make);
