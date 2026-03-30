import { existsSync } from "node:fs";
import { Command, Options } from "@effect/cli";
import {
  badge,
  bold,
  dim,
  type EnvFileExport,
  formatTimeDistance,
  icons,
  indent,
  parseDuration,
  type SecretMetadata,
  SecretStore,
} from "@envsec/core";
import { Console, Duration, Effect, Option } from "effect";
import { isJsonOutput, optionalContext } from "./root.js";

const DEFAULT_WINDOW = "30d";

const withinOption = Options.text("within").pipe(
  Options.withAlias("w"),
  Options.withDescription(
    "Show secrets expiring within this duration (default: 30d). Use 0d to show only already-expired."
  ),
  Options.optional
);

const isExpired = (expiresAt: string | null, now: number): boolean =>
  expiresAt ? new Date(`${expiresAt}Z`).getTime() <= now : false;

const formatLine = (
  key: string,
  expiresAt: string | null,
  now: number,
  prefix?: string
): string => {
  const distance = expiresAt ? formatTimeDistance(expiresAt) : "unknown";
  const expired = isExpired(expiresAt, now);
  const icon = expired ? icons.expired : icons.clock;
  const label = expired ? "expired" : "expires";
  const ctx = prefix ? dim(`[${prefix}] `) : "";
  return indent(`${icon} ${ctx}${key}  ${label} ${distance}`);
};

const countExpired = (
  secrets: Array<{ expires_at: string | null }>,
  now: number
): { expired: number; expiring: number } => {
  const expired = secrets.filter((s) => isExpired(s.expires_at, now)).length;
  return { expired, expiring: secrets.length - expired };
};

const auditForContext = (
  ctx: string,
  secrets: SecretMetadata[],
  windowStr: string,
  now: number
) =>
  Effect.gen(function* () {
    if (secrets.length === 0) {
      yield* Console.log(
        `${icons.check} No secrets expiring within ${bold(windowStr)} in ${bold(`"${ctx}"`)}`
      );
      return;
    }
    yield* Console.log(
      `${icons.search} Secrets expiring within ${bold(windowStr)} in ${bold(`"${ctx}"`)}:\n`
    );
    for (const s of secrets) {
      yield* Console.log(formatLine(s.key, s.expires_at, now));
    }
    const { expired, expiring } = countExpired(secrets, now);
    yield* Console.log(
      `\n${icons.chart} ${bold(String(expired))} expired, ${bold(String(expiring))} expiring soon ${dim(`(${secrets.length} total)`)}`
    );
  });

const auditAllContexts = (
  secrets: Array<SecretMetadata & { env: string }>,
  windowStr: string,
  now: number
) =>
  Effect.gen(function* () {
    if (secrets.length === 0) {
      yield* Console.log(
        `${icons.check} No secrets expiring within ${bold(windowStr)} across all contexts`
      );
      return;
    }
    yield* Console.log(
      `${icons.search} Secrets expiring within ${bold(windowStr)} across all contexts:\n`
    );
    for (const s of secrets) {
      yield* Console.log(formatLine(s.key, s.expires_at, now, s.env));
    }
    const { expired, expiring } = countExpired(secrets, now);
    const contextCount = new Set(secrets.map((s) => s.env)).size;
    yield* Console.log(
      `\n${icons.chart} ${bold(String(expired))} expired, ${bold(String(expiring))} expiring soon across ${badge(contextCount, "context")} ${dim(`(${secrets.length} total)`)}`
    );
  });

const pruneStaleEnvExports = (exports: EnvFileExport[]) =>
  Effect.gen(function* () {
    const alive: EnvFileExport[] = [];
    const stale: EnvFileExport[] = [];

    for (const e of exports) {
      if (existsSync(e.path)) {
        alive.push(e);
      } else {
        stale.push(e);
      }
    }

    for (const e of stale) {
      yield* SecretStore.removeEnvFileExport(e.path);
    }

    if (stale.length > 0) {
      yield* Console.log(
        `\n${icons.broom} Removed ${badge(stale.length, "stale env file record")} ${dim("(files no longer on disk)")}`
      );
    }

    return alive;
  });

const auditEnvFileExports = (
  exports: EnvFileExport[],
  jsonMode: boolean,
  contextFilter?: string
) =>
  Effect.gen(function* () {
    const filtered = contextFilter
      ? exports.filter((e) => e.context === contextFilter)
      : exports;

    if (jsonMode) {
      return filtered;
    }

    if (filtered.length === 0) {
      return filtered;
    }

    yield* Console.log(`\n${icons.file} Generated .env files:\n`);
    for (const e of filtered) {
      const date = e.created_at.replace("T", " ").slice(0, 19);
      yield* Console.log(indent(`${icons.file} ${e.path}`));
      yield* Console.log(
        indent(`${dim(`context: ${e.context}  generated: ${date}`)}`, 2)
      );
    }
    yield* Console.log(
      `\n${icons.chart} ${badge(filtered.length, "env file")} generated`
    );
    return filtered;
  });

export const auditCommand = Command.make(
  "audit",
  { within: withinOption },
  ({ within }) =>
    Effect.gen(function* () {
      const context = yield* optionalContext;
      const jsonMode = yield* isJsonOutput;
      const windowStr = Option.isSome(within) ? within.value : DEFAULT_WINDOW;
      const windowDuration = yield* parseDuration(windowStr);
      const windowMs = Duration.toMillis(windowDuration);
      const now = Date.now();

      const envExports = yield* pruneStaleEnvExports(
        yield* SecretStore.listEnvFileExports()
      );

      if (Option.isSome(context)) {
        const secrets = yield* SecretStore.listExpiring(
          context.value,
          windowMs
        );

        if (jsonMode) {
          const items = secrets.map((s) => ({
            context: context.value,
            key: s.key,
            expires_at: s.expires_at,
            expired: isExpired(s.expires_at, now),
          }));
          const filteredExports = envExports.filter(
            (e) => e.context === context.value
          );
          yield* Console.log(
            JSON.stringify({ secrets: items, env_files: filteredExports })
          );
          return;
        }

        yield* auditForContext(context.value, secrets, windowStr, now);
        yield* auditEnvFileExports(envExports, false, context.value);
        return;
      }

      const secrets = yield* SecretStore.listAllExpiring(windowMs);

      if (jsonMode) {
        const items = secrets.map((s) => ({
          context: s.env,
          key: s.key,
          expires_at: s.expires_at,
          expired: isExpired(s.expires_at, now),
        }));
        yield* Console.log(
          JSON.stringify({ secrets: items, env_files: envExports })
        );
        return;
      }

      yield* auditAllContexts(secrets, windowStr, now);
      yield* auditEnvFileExports(envExports, false);
    })
);
