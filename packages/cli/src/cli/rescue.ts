import { statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  badge,
  bold,
  dim,
  FileAccessError,
  icons,
  indent,
  SecretStore,
  separator,
} from "@envsec/core";
import { Console, Effect } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/cli";

import { appendToGitignore, gitFileStatus } from "../rescue/git.js";
import type { GitFileStatus } from "../rescue/git.js";
import {
  allContexts,
  allFiles,
  buildRescuePlan,
  countSecrets,
  DEFAULT_MAX_DEPTH,
} from "../rescue/scan.js";
import type { RescueContext, RescueFile, RescuePlan } from "../rescue/scan.js";
import { isJsonOutput } from "./root.js";

const pathArg = Args.String("path").pipe(
  Args.withDescription("Directory to scan recursively (default: .)"),
  Args.withDefault(".")
);

const importOption = Options.Boolean("import").pipe(
  Options.withAlias("i"),
  Options.withDescription(
    "Import the secrets into the keychain (without it, rescue only reports)"
  ),
  Options.withDefault(false)
);

const forceOption = Options.Boolean("force").pipe(
  Options.withAlias("f"),
  Options.withDescription(
    "With --import, overwrite secrets already in the keychain with a different value"
  ),
  Options.withDefault(false)
);

const removePlaintextOption = Options.Boolean("remove-plaintext").pipe(
  Options.withDescription(
    "Delete each .env file whose secrets are all verified in the keychain"
  ),
  Options.withDefault(false)
);

const gitignoreOption = Options.Boolean("gitignore").pipe(
  Options.withDescription(
    "With --import or --remove-plaintext, add the .env files to .gitignore (default: on, --no-gitignore to skip)"
  ),
  Options.withDefault(true)
);

const depthOption = Options.Int("depth").pipe(
  Options.withDescription(
    `Maximum directory depth to scan (default: ${DEFAULT_MAX_DEPTH})`
  ),
  Options.withDefault(DEFAULT_MAX_DEPTH)
);

type ImportStatus =
  | "added"
  | "overwritten"
  | "unchanged"
  | "conflict"
  | "missing"
  | "failed";

interface ImportOutcome {
  readonly context: string;
  readonly key: string;
  readonly message?: string;
  readonly status: ImportStatus;
}

const SECURED: ReadonlySet<ImportStatus> = new Set([
  "added",
  "overwritten",
  "unchanged",
]);

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const home = homedir();

/** Shorten paths under the home directory to `~/...` for display. */
const displayPath = (filePath: string): string =>
  filePath === home || filePath.startsWith(`${home}${path.sep}`)
    ? `~${filePath.slice(home.length)}`
    : filePath;

const outcomeKey = (context: string, key: string) => `${context}\u0000${key}`;

// ── Report ──────────────────────────────────────────────────────────

const printFiles = Effect.fn("printFiles")(function* printFiles(
  plan: RescuePlan,
  git: ReadonlyMap<string, GitFileStatus | null>
) {
  const rows = plan.projects.flatMap((project) =>
    project.contexts.flatMap((context) =>
      context.files.map((file) => ({
        context: context.name,
        file,
        project,
        relative: path.relative(project.root, file.path),
      }))
    )
  );
  const width = Math.max(...rows.map((row) => row.relative.length));

  let currentProject = "";
  for (const row of rows) {
    if (row.project.root !== currentProject) {
      currentProject = row.project.root;
      yield* Console.log(
        `\n${icons.folder} ${bold(row.project.name)}  ${dim(displayPath(row.project.root))}`
      );
    }
    const count = row.file.entries.length;
    const secrets = `${String(count).padStart(3)} ${count === 1 ? "secret " : "secrets"}`;
    const tracked = git.get(row.file.path)?.tracked
      ? `  ${icons.warning} committed to git`
      : "";
    yield* Console.log(
      indent(
        `${icons.file} ${row.relative.padEnd(width)}  ${secrets}  ${icons.arrow} ${bold(row.context)}${tracked}`,
        2
      )
    );
  }
});

const MAX_LISTED = 5;

const printFindings = Effect.fn("printFindings")(function* printFindings(
  plan: RescuePlan,
  git: ReadonlyMap<string, GitFileStatus | null>
) {
  const files = allFiles(plan);
  yield* Console.log(`\n${separator()}`);
  yield* Console.log(
    `${icons.chart} ${badge(countSecrets(plan), "secret")} in ${badge(files.length, "file")} ${dim("·")} ${badge(plan.projects.length, "project")} ${dim("·")} ${badge(allContexts(plan).length, "context")}`
  );

  if (plan.duplicates.length > 0) {
    yield* Console.log(
      `${icons.key} ${badge(plan.duplicates.length, "value")} ${plan.duplicates.length === 1 ? "appears" : "appear"} in more than one place:`
    );
    for (const duplicate of plan.duplicates.slice(0, MAX_LISTED)) {
      const [first] = duplicate.locations;
      const contexts = [
        ...new Set(duplicate.locations.map((l) => l.context)),
      ].join(", ");
      yield* Console.log(
        indent(
          `${first?.name ?? ""} ${dim(`×${duplicate.locations.length}`)}  ${dim(contexts)}`,
          2
        )
      );
    }
    if (plan.duplicates.length > MAX_LISTED) {
      yield* Console.log(
        indent(dim(`… and ${plan.duplicates.length - MAX_LISTED} more`), 2)
      );
    }
  }

  const tracked = files.filter((file) => git.get(file.path)?.tracked);
  if (tracked.length > 0) {
    yield* Console.log(
      `${icons.warning} ${badge(tracked.length, "file")} ${tracked.length === 1 ? "is" : "are"} committed to git: rotate ${tracked.length === 1 ? "its" : "their"} secrets, removing a file does not erase history`
    );
  }

  const invalid = files.flatMap((file) =>
    file.invalidNames.map(
      (name) => `${name} ${dim(`(${displayPath(file.path)})`)}`
    )
  );
  if (invalid.length > 0) {
    yield* Console.log(
      `${icons.warning} ${badge(invalid.length, "variable")} with a name envsec cannot store (left in place):`
    );
    for (const line of invalid.slice(0, MAX_LISTED)) {
      yield* Console.log(indent(line, 2));
    }
  }

  const unreadable = files.filter((file) => file.unreadable);
  for (const file of unreadable) {
    yield* Console.log(
      `${icons.warning} Cannot read ${displayPath(file.path)} ${dim("(skipped)")}`
    );
  }

  const empty = files.reduce((sum, file) => sum + file.emptyNames.length, 0);
  if (empty > 0) {
    yield* Console.log(
      dim(`${badge(empty, "empty variable")} ignored (nothing to secure)`)
    );
  }
  if (plan.skippedExports.length > 0) {
    yield* Console.log(
      dim(
        `${badge(plan.skippedExports.length, "file")} generated by envsec env-file ignored (already in the keychain)`
      )
    );
  }
});

// ── Import ──────────────────────────────────────────────────────────

/**
 * Compare one secret with the keychain and, when `write` is set, store it.
 * Without `write` nothing changes: a secret not in the keychain is "missing".
 */
const syncSecret = (
  context: string,
  key: string,
  value: string,
  options: {
    readonly exists: boolean;
    readonly force: boolean;
    readonly write: boolean;
  }
) =>
  Effect.gen(function* storeSecret() {
    if (options.exists) {
      const current = yield* SecretStore.get(context, key).pipe(
        Effect.orElseSucceed(() => null)
      );
      if (current === value) {
        return "unchanged" as const;
      }
      if (!(options.write && options.force)) {
        return "conflict" as const;
      }
    }
    if (!options.write) {
      return "missing" as const;
    }
    yield* SecretStore.set(context, key, value);
    return options.exists ? ("overwritten" as const) : ("added" as const);
  }).pipe(
    Effect.match({
      onFailure: (failure): ImportOutcome => ({
        context,
        key,
        message: messageOf(failure),
        status: "failed",
      }),
      onSuccess: (status): ImportOutcome => ({ context, key, status }),
    })
  );

const syncContext = Effect.fn("syncContext")(function* syncContext(
  context: RescueContext,
  options: { readonly force: boolean; readonly write: boolean }
) {
  const existing = new Set(
    (yield* SecretStore.list(context.name)).map((item) => item.key)
  );
  const outcomes: ImportOutcome[] = [];
  for (const [key, secret] of context.secrets) {
    outcomes.push(
      yield* syncSecret(context.name, key, secret.value, {
        ...options,
        exists: existing.has(key),
      })
    );
  }
  return outcomes;
});

/**
 * Import every context of the plan (batching metadata writes), or with
 * `write: false` only check which secrets the keychain already holds.
 */
const syncPlan = (
  plan: RescuePlan,
  options: { readonly force: boolean; readonly write: boolean }
) =>
  SecretStore.withBatch(
    Effect.forEach(
      allContexts(plan),
      (context) => syncContext(context, options),
      { concurrency: 1 }
    )
  ).pipe(Effect.map((perContext) => perContext.flat()));

// ── Plaintext cleanup ───────────────────────────────────────────────

/**
 * Why `file` must stay on disk, or null when it may be deleted: every value
 * in it is in the keychain exactly as written. A value overridden by
 * another file (e.g. `.env` by `.env.local`) keeps its file around.
 */
const keepReason = (
  file: RescueFile,
  context: RescueContext,
  outcomes: ReadonlyMap<string, ImportOutcome>
): string | null => {
  if (file.unreadable) {
    return "cannot be read";
  }
  if (file.invalidNames.length > 0) {
    return `${file.invalidNames.join(", ")} cannot be stored`;
  }
  if (file.entries.length === 0) {
    return "holds no secrets";
  }
  for (const entry of file.entries) {
    const status = outcomes.get(outcomeKey(context.name, entry.key))?.status;
    if (status === "conflict") {
      return `${entry.name} differs from the keychain (use --import --force)`;
    }
    if (status === "missing") {
      return `${entry.name} is not in the keychain yet (use --import)`;
    }
    if (status === undefined || !SECURED.has(status)) {
      return `${entry.name} could not be imported`;
    }
    const winner = context.secrets.get(entry.key);
    if (winner?.value !== entry.value) {
      return `${entry.name} is overridden by ${path.basename(winner?.file ?? "")}`;
    }
  }
  return null;
};

/** Read every secret of `file` back from the keychain before deleting it. */
const verifyInKeychain = (file: RescueFile) =>
  Effect.forEach(
    file.entries,
    (entry) =>
      SecretStore.get(file.context, entry.key).pipe(
        Effect.map((stored) => stored === entry.value),
        Effect.orElseSucceed(() => false)
      ),
    { concurrency: 4 }
  ).pipe(Effect.map((checks) => checks.every(Boolean)));

const removeFile = (file: RescueFile) =>
  Effect.try({
    catch: (error) =>
      new FileAccessError({
        cause: error,
        message: `Cannot delete ${file.path}: ${messageOf(error)}`,
        path: file.path,
      }),
    try: () => unlinkSync(file.path),
  }).pipe(
    Effect.matchEffect({
      onFailure: (failure) =>
        Console.error(`${icons.error} ${failure.message}`).pipe(
          Effect.as(false)
        ),
      onSuccess: () => Effect.succeed(true),
    })
  );

// ── .gitignore ──────────────────────────────────────────────────────

const updateGitignores = (
  plan: RescuePlan,
  git: ReadonlyMap<string, GitFileStatus | null>
) => {
  const patternsByRepo = new Map<string, string[]>();
  for (const file of allFiles(plan)) {
    const status = git.get(file.path);
    if (!status || status.ignored) {
      continue;
    }
    const patterns = patternsByRepo.get(status.topLevel) ?? [];
    patterns.push(path.basename(file.path));
    patternsByRepo.set(status.topLevel, patterns);
  }
  return Effect.forEach([...patternsByRepo], ([topLevel, patterns]) =>
    Effect.try({
      catch: (error) =>
        new FileAccessError({
          cause: error,
          message: `Cannot update ${path.join(topLevel, ".gitignore")}: ${messageOf(error)}`,
          path: topLevel,
        }),
      try: () => ({ added: appendToGitignore(topLevel, patterns), topLevel }),
    }).pipe(
      Effect.matchEffect({
        onFailure: (failure) =>
          Console.error(`${icons.warning} ${failure.message}`).pipe(
            Effect.as({ added: [] as string[], topLevel })
          ),
        onSuccess: Effect.succeed,
      })
    )
  ).pipe(Effect.map((results) => results.filter((r) => r.added.length > 0)));
};

// ── JSON ────────────────────────────────────────────────────────────

const planToJson = (
  plan: RescuePlan,
  git: ReadonlyMap<string, GitFileStatus | null>
) => ({
  duplicates: plan.duplicates.map((d) => d.locations),
  projects: plan.projects.map((project) => ({
    contexts: project.contexts.map((context) => ({
      files: context.files.map((file) => ({
        committed: git.get(file.path)?.tracked ?? false,
        empty: file.emptyNames,
        invalid: file.invalidNames,
        keys: file.entries.map((entry) => entry.key),
        path: file.path,
        unreadable: file.unreadable,
      })),
      name: context.name,
      secrets: context.secrets.size,
    })),
    name: project.name,
    root: project.root,
  })),
  root: plan.root,
  secrets: countSecrets(plan),
  skipped_env_file_exports: plan.skippedExports,
});

// ── Command ─────────────────────────────────────────────────────────

const resolveRoot = (input: string) =>
  Effect.try({
    catch: () =>
      new FileAccessError({
        message: `Not a directory: ${input}`,
        path: input,
      }),
    try: () => {
      const root = path.resolve(input);
      if (!statSync(root).isDirectory()) {
        throw new Error("not a directory");
      }
      return root;
    },
  });

interface RescueOptions {
  readonly depth: number;
  readonly force: boolean;
  readonly gitignore: boolean;
  readonly import: boolean;
  readonly path: string;
  readonly removePlaintext: boolean;
}

interface KeptFile {
  readonly file: RescueFile;
  readonly reason: string;
}

/** Split files into the ones safe to delete and the ones to keep (with why). */
const triageFiles = (
  plan: RescuePlan,
  outcomeList: readonly ImportOutcome[]
) => {
  const outcomes = new Map(
    outcomeList.map((o) => [outcomeKey(o.context, o.key), o])
  );
  const contextByName = new Map(allContexts(plan).map((c) => [c.name, c]));
  const deletable: RescueFile[] = [];
  const kept: KeptFile[] = [];
  for (const file of allFiles(plan)) {
    const context = contextByName.get(file.context);
    const reason = context
      ? keepReason(file, context, outcomes)
      : "has no context";
    if (reason === null) {
      deletable.push(file);
    } else {
      kept.push({ file, reason });
    }
  }
  return { deletable, kept };
};

/** Delete the plaintext files, each after a keychain read-back. */
const removePlaintextFiles = Effect.fn("removePlaintextFiles")(
  function* removePlaintextFiles(deletable: readonly RescueFile[]) {
    const removed: RescueFile[] = [];
    const kept: KeptFile[] = [];
    for (const file of deletable) {
      if (!(yield* verifyInKeychain(file))) {
        kept.push({ file, reason: "keychain read-back did not match" });
      } else if (yield* removeFile(file)) {
        removed.push(file);
      } else {
        kept.push({ file, reason: "could not be deleted" });
      }
    }
    return { kept, removed };
  }
);

interface RescueResult {
  readonly gitignoreUpdates: readonly {
    readonly added: readonly string[];
    readonly topLevel: string;
  }[];
  readonly kept: readonly KeptFile[];
  readonly outcomes: readonly ImportOutcome[];
  readonly removed: readonly RescueFile[];
}

const printOutcomes = Effect.fn("printOutcomes")(function* printOutcomes(
  result: RescueResult
) {
  const conflicts = result.outcomes.filter((o) => o.status === "conflict");
  if (conflicts.length > 0) {
    yield* Console.log(
      `${icons.warning} ${badge(conflicts.length, "secret")} already in the keychain with a different value ${dim("(kept; use --import --force to overwrite)")}:`
    );
    for (const conflict of conflicts.slice(0, MAX_LISTED)) {
      yield* Console.log(indent(`${conflict.context} ${dim(conflict.key)}`, 2));
    }
  }
  const missing = result.outcomes.filter((o) => o.status === "missing");
  if (missing.length > 0) {
    yield* Console.log(
      `${icons.warning} ${badge(missing.length, "secret")} not in the keychain yet ${dim("(use --import)")}`
    );
  }
  for (const failure of result.outcomes) {
    if (failure.status === "failed") {
      yield* Console.log(
        `${icons.error} ${failure.context} ${failure.key}: ${failure.message ?? "failed"}`
      );
    }
  }
  for (const update of result.gitignoreUpdates) {
    yield* Console.log(
      `${icons.lock} ${update.added.join(", ")} added to ${displayPath(path.join(update.topLevel, ".gitignore"))}`
    );
  }
});

/** The command line to re-run rescue on the same path with extra flags. */
const rerunCommand = (options: RescueOptions, flags: string) =>
  `envsec rescue ${options.path} ${flags}`;

const rerun = (options: RescueOptions, flags: string) =>
  bold(rerunCommand(options, flags));

const NEXT_STEPS = [
  ["--import", "move the secrets into the keychain"],
  ["--import --remove-plaintext", "…and delete the .env files"],
] as const;

const printNextSteps = Effect.fn("printNextSteps")(function* printNextSteps(
  options: RescueOptions
) {
  yield* Console.log(`\n${icons.info} Nothing changed. Next:`);
  const width = Math.max(
    ...NEXT_STEPS.map(([flags]) => rerunCommand(options, flags).length)
  );
  for (const [flags, description] of NEXT_STEPS) {
    const command = rerunCommand(options, flags);
    yield* Console.log(
      indent(
        `${bold(command)}${" ".repeat(width - command.length)}  ${dim(description)}`,
        2
      )
    );
  }
});

const printSummary = Effect.fn("printSummary")(function* printSummary(
  plan: RescuePlan,
  options: RescueOptions,
  result: RescueResult
) {
  const secured = result.outcomes.filter((o) => SECURED.has(o.status)).length;
  const fileSummary = options.removePlaintext
    ? `${badge(result.removed.length, "plaintext file")} removed`
    : `${badge(allFiles(plan).length, "plaintext file")} left in place`;
  yield* Console.log(
    `\n${icons.success} ${badge(secured, "secret")} secured ${dim("·")} ${fileSummary}`
  );

  if (options.removePlaintext && result.kept.length > 0) {
    yield* Console.log(
      `${icons.warning} ${badge(result.kept.length, "file")} kept:`
    );
    for (const { file, reason } of result.kept) {
      yield* Console.log(
        indent(`${path.relative(plan.root, file.path)}  ${dim(reason)}`, 2)
      );
    }
  }
  if (!options.removePlaintext) {
    yield* Console.log(
      dim(
        `  Delete them once you are ready: ${rerun(options, "--remove-plaintext")}`
      )
    );
  }
  const [example] = allContexts(plan);
  if (example && secured > 0) {
    yield* Console.log(
      `${icons.shell} Next: ${bold(`envsec -c ${example.name} run --inject "<your command>"`)}`
    );
  }
});

/** Import and/or check the keychain, update .gitignore, delete files. */
const applyPlan = Effect.fn("applyPlan")(function* applyPlan(
  plan: RescuePlan,
  git: ReadonlyMap<string, GitFileStatus | null>,
  options: RescueOptions
) {
  const outcomes = yield* syncPlan(plan, {
    force: options.force,
    write: options.import,
  });
  const gitignoreUpdates = options.gitignore
    ? yield* updateGitignores(plan, git)
    : [];
  const triage = triageFiles(plan, outcomes);
  const deletion = options.removePlaintext
    ? yield* removePlaintextFiles(triage.deletable)
    : { kept: [], removed: [] };
  return {
    gitignoreUpdates,
    kept: [...triage.kept, ...deletion.kept],
    outcomes,
    removed: deletion.removed,
  } satisfies RescueResult;
});

const printJson = (
  plan: RescuePlan,
  git: ReadonlyMap<string, GitFileStatus | null>,
  extra: Record<string, unknown>
) => Console.log(JSON.stringify({ ...planToJson(plan, git), ...extra }));

const handler = Effect.fn("rescue")(function* handler(options: RescueOptions) {
  const jsonMode = yield* isJsonOutput;
  const root = yield* resolveRoot(options.path);
  const exportedPaths = new Set(
    (yield* SecretStore.listEnvFileExports()).map((e) => e.path)
  );
  if (!jsonMode) {
    yield* Console.log(`${icons.search} Scanning ${bold(displayPath(root))}…`);
  }
  const plan = buildRescuePlan(root, {
    exportedPaths,
    maxDepth: options.depth,
  });
  const git = new Map(
    allFiles(plan).map((file) => [file.path, gitFileStatus(file.path)])
  );
  const reportOnly = !(options.import || options.removePlaintext);
  const nothingToDo = countSecrets(plan) === 0;

  if (jsonMode && (nothingToDo || reportOnly)) {
    return yield* printJson(plan, git, { changed: false });
  }
  if (nothingToDo) {
    return yield* Console.log(
      `${icons.check} No plaintext secrets found in .env files under ${bold(displayPath(root))}`
    );
  }
  if (!jsonMode) {
    yield* printFiles(plan, git);
    yield* printFindings(plan, git);
  }
  if (reportOnly) {
    return yield* printNextSteps(options);
  }

  const result = yield* applyPlan(plan, git, options);

  if (jsonMode) {
    return yield* printJson(plan, git, {
      changed: true,
      gitignore: result.gitignoreUpdates,
      kept: options.removePlaintext
        ? result.kept.map(({ file, reason }) => ({ path: file.path, reason }))
        : [],
      removed: result.removed.map((file) => file.path),
      result: result.outcomes,
    });
  }
  yield* Console.log("");
  yield* printOutcomes(result);
  yield* printSummary(plan, options, result);
});

export const rescueCommand = Command.make(
  "rescue",
  // oxlint-disable-next-line sort-keys -- key order sets the argument/flag order in --help
  {
    path: pathArg,
    import: importOption,
    force: forceOption,
    removePlaintext: removePlaintextOption,
    gitignore: gitignoreOption,
    depth: depthOption,
  },
  handler
).pipe(
  Command.withDescription(
    "Find plaintext .env files in a directory tree; --import moves their secrets into the keychain"
  )
);
