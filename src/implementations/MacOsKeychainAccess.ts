import { Effect, Layer } from "effect"
import { KeychainAccess } from "../services/KeychainAccess.js"
import { KeychainError, SecretNotFoundError } from "../errors.js"

const run = (args: Array<string>) =>
  Effect.tryPromise({
    try: () => Bun.$`security ${args}`.nothrow().quiet(),
    catch: (error) =>
      new KeychainError({
        command: args[0] ?? "unknown",
        stderr: String(error),
        message: `Failed to run security command`,
      }),
  })

const make = KeychainAccess.of({
  set: Effect.fn("MacOsKeychainAccess.set")(function* (
    service: string,
    account: string,
    password: string,
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
    ])

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "add-generic-password",
        stderr: result.stderr.toString(),
        message: `Failed to set keychain item: ${service}/${account}`,
      })
    }
  }),

  get: Effect.fn("MacOsKeychainAccess.get")(function* (
    service: string,
    account: string,
  ) {
    const result = yield* run([
      "find-generic-password",
      "-s",
      service,
      "-a",
      account,
      "-w",
    ])

    if (result.exitCode === 44) {
      return yield* new SecretNotFoundError({
        key: account,
        env: service,
        message: `Secret not found: ${service}/${account}`,
      })
    }

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "find-generic-password",
        stderr: result.stderr.toString(),
        message: `Failed to get keychain item: ${service}/${account}`,
      })
    }

    return result.stdout.toString().trim()
  }),

  remove: Effect.fn("MacOsKeychainAccess.remove")(function* (
    service: string,
    account: string,
  ) {
    const result = yield* run([
      "delete-generic-password",
      "-s",
      service,
      "-a",
      account,
    ])

    if (result.exitCode !== 0) {
      return yield* new KeychainError({
        command: "delete-generic-password",
        stderr: result.stderr.toString(),
        message: `Failed to remove keychain item: ${service}/${account}`,
      })
    }
  }),
})

export const MacOsKeychainAccessLive = Layer.succeed(KeychainAccess, make)
