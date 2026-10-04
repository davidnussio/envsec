import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Effect } from "effect";
import { SecretStore } from "./secret-store.js";

const FILE_PERMISSIONS = 0o600;
const DIR_PERMISSIONS = 0o700;

/**
 * Rebuild the completion cache from the current SecretStore state.
 * Called after mutating operations (add, delete, load, cmd save, etc.)
 * and after slow-path completion queries.
 */
export const refreshCache = Effect.fn("refreshCache")(
  function* (cachePath: string) {
    const contexts = yield* SecretStore.listContexts();
    const contextNames = contexts.map((c) => c.context);

    const keys: Record<string, string[]> = {};
    for (const ctx of contextNames) {
      const secrets = yield* SecretStore.list(ctx);
      keys[ctx] = secrets.map((s) => s.key);
    }

    const cmds = yield* SecretStore.listCommands();
    const commandNames = cmds.map((c) => c.name);

    const data = {
      commands: commandNames,
      contexts: contextNames,
      keys,
      updatedAt: Date.now(),
    };

    // Effect.try turns a throwing fs call into a typed failure; a bare throw
    // inside the generator would be a defect that Effect.ignore cannot catch.
    yield* Effect.try(() => {
      mkdirSync(dirname(cachePath), { recursive: true, mode: DIR_PERMISSIONS });
      writeFileSync(cachePath, JSON.stringify(data), {
        mode: FILE_PERMISSIONS,
      });
    });
  },
  // The completion cache is best-effort: never fail the calling command.
  (effect) => Effect.ignore(effect)
);
