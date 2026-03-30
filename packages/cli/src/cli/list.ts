import { Command } from "@effect/cli";
import {
  badge,
  bold,
  dim,
  formatTimeDistance,
  icons,
  SecretStore,
} from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { isJsonOutput, optionalContext } from "./root.js";

const formatSecretLine = (
  item: { key: string; updated_at: string; expires_at: string | null },
  now: number
): string => {
  const updated = dim(`updated: ${item.updated_at}`);
  if (!item.expires_at) {
    return `${icons.key} ${item.key}  ${updated}`;
  }
  const expiresMs = new Date(`${item.expires_at}Z`).getTime();
  const expired = expiresMs <= now;
  const distance = formatTimeDistance(item.expires_at);
  const expiry = expired
    ? `${icons.expired} expired ${distance}`
    : `${icons.clock} expires ${distance}`;
  return `${icons.key} ${item.key}  ${updated}  ${expiry}`;
};

const listContexts = (jsonMode: boolean) =>
  Effect.gen(function* () {
    const contexts = yield* SecretStore.listContexts();
    if (jsonMode) {
      yield* Console.log(JSON.stringify(contexts));
      return;
    }
    if (contexts.length === 0) {
      yield* Console.log(`${icons.empty} No contexts found.`);
      return;
    }
    for (const item of contexts) {
      yield* Console.log(
        `${icons.folder} ${bold(item.context)}  ${dim(`(${item.count} secrets)`)}`
      );
    }
  });

const listSecrets = (ctx: string, jsonMode: boolean) =>
  Effect.gen(function* () {
    const results = yield* SecretStore.list(ctx);
    if (jsonMode) {
      yield* Console.log(JSON.stringify(results));
      return;
    }
    if (results.length === 0) {
      yield* Console.log(`${icons.empty} No secrets found.`);
      return;
    }
    const now = Date.now();
    for (const item of results) {
      yield* Console.log(formatSecretLine(item, now));
    }
    yield* Console.log(
      `\n${icons.chart} ${badge(results.length, "secret")} in ${bold(ctx)}`
    );
  });

export const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const context = yield* optionalContext;
    const jsonMode = yield* isJsonOutput;

    if (Option.isNone(context)) {
      yield* listContexts(jsonMode);
      return;
    }
    yield* listSecrets(context.value, jsonMode);
  })
);
