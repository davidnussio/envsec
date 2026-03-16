import { Effect } from "effect"
import { InvalidKeyError } from "../errors.js"

export interface ParsedKey {
  readonly service: string
  readonly account: string
}

export const parse = Effect.fn("SecretKey.parse")(function* (
  key: string,
  env: string,
) {
  const parts = key.split(".")
  if (parts.length < 2) {
    return yield* new InvalidKeyError({
      key,
      message: `Key "${key}" must have at least 2 dot-separated parts (e.g. "service.account")`,
    })
  }

  const account = parts[parts.length - 1]!
  const serviceParts = parts.slice(0, -1)

  return {
    service: `secenv.${env}.${serviceParts.join(".")}`,
    account,
  } satisfies ParsedKey
})
