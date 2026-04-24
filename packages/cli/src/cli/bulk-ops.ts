import { type MetadataStoreError, SecretStore } from "@envsec/core";
import { Effect, Option } from "effect";

/** Convert a glob pattern (with * and ?) to a RegExp */
export const globToRegex = (pat: string): RegExp => {
  const escaped = pat.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withWildcards = escaped.replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${withWildcards}$`);
};

/** Resolve which keys to operate on based on --all flag or glob pattern */
export const resolveKeys = (
  sourceCtx: string,
  pat: Option.Option<string>,
  useAll: boolean,
  verb: string
): Effect.Effect<string[], MetadataStoreError | Error, SecretStore> =>
  Effect.gen(function* () {
    if (useAll) {
      const items = yield* SecretStore.list(sourceCtx);
      return items.map((i) => i.key);
    }
    if (Option.isNone(pat)) {
      return yield* Effect.fail(
        new Error(
          `Provide a <pattern> argument or use --all to ${verb} everything`
        )
      );
    }
    const p = pat.value;
    if (p.includes("*") || p.includes("?")) {
      const items = yield* SecretStore.list(sourceCtx);
      const regex = globToRegex(p);
      return items.filter((i) => regex.test(i.key)).map((i) => i.key);
    }
    return [p];
  });

/** Check for conflicts in target context */
export const checkConflicts = (
  targetCtx: string,
  keys: string[]
): Effect.Effect<void, Error, SecretStore> =>
  Effect.gen(function* () {
    const targetItems = yield* SecretStore.list(targetCtx).pipe(
      Effect.catchTag("MetadataStoreError", () => Effect.succeed([]))
    );
    const targetKeys = new Set(targetItems.map((i) => i.key));
    const conflicts = keys.filter((k) => targetKeys.has(k));
    if (conflicts.length > 0) {
      yield* Effect.fail(
        new Error(
          `Target context "${targetCtx}" already has: ${conflicts.join(", ")}. Use --force to overwrite.`
        )
      );
    }
  });
