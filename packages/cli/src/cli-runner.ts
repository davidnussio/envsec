import { createRequire } from "node:module";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  DatabaseConfigDefault,
  DatabaseConfigFrom,
  refreshCache,
  SecretStore,
} from "@envsec/core";
import { Console, Effect, Layer, References } from "effect";
import { Command } from "effect/cli";
import { addCommand } from "./cli/add.js";
import { auditCommand } from "./cli/audit.js";
import { cmdCommand } from "./cli/cmd.js";
import { handleComplete } from "./cli/complete.js";
import { copyCommand } from "./cli/copy.js";
import { deleteCommand } from "./cli/delete.js";
import { doctorCommand } from "./cli/doctor.js";
import { envCommand } from "./cli/env.js";
import { envFileCommand } from "./cli/env-file.js";
import { getCommand } from "./cli/get.js";
import { listCommand } from "./cli/list.js";
import { loadCommand } from "./cli/load.js";
import { moveCommand } from "./cli/move.js";
import { renameCommand } from "./cli/rename.js";
import { rootCommand } from "./cli/root.js";
import { runCommand } from "./cli/run.js";
import { searchCommand } from "./cli/search.js";
import { secretCommand } from "./cli/secret.js";
import { shareCommand } from "./cli/share.js";
import { shellCommand } from "./cli/shell.js";
import { tuiCommand } from "./cli/tui.js";
import { generateCompletions, type ShellType } from "./completions/index.js";
import { reportErrors } from "./report-errors.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const command = rootCommand.pipe(
  Command.withSubcommands([
    addCommand,
    getCommand,
    deleteCommand,
    renameCommand,
    listCommand,
    searchCommand,
    secretCommand,
    moveCommand,
    copyCommand,
    runCommand,
    cmdCommand,
    envFileCommand,
    envCommand,
    loadCommand,
    shareCommand,
    shellCommand,
    tuiCommand,
    auditCommand,
    doctorCommand,
  ]),
  // --debug is a shortcut for --log-level debug.
  Command.provide(({ debug }) =>
    debug ? Layer.succeed(References.MinimumLogLevel, "Debug") : Layer.empty
  )
);

const cli = Command.runWith(command, {
  version: pkg.version,
})(process.argv.slice(2));

const interceptCompletions = (): ShellType | null => {
  const idx = process.argv.indexOf("--completions");
  if (idx === -1) {
    return null;
  }
  const shell = process.argv[idx + 1];
  if (shell === "bash" || shell === "zsh" || shell === "fish") {
    return shell;
  }
  if (shell === "sh") {
    return "bash";
  }
  return null;
};

const interceptComplete = (): { type: string; arg?: string } | null => {
  const args = process.argv.slice(2);
  if (args[0] !== "__complete") {
    return null;
  }
  return { type: args[1] ?? "", arg: args[2] };
};

/** Commands that mutate secrets or saved commands — trigger cache refresh. */
const MUTATING_COMMANDS = new Set([
  "add",
  "delete",
  "del",
  "load",
  "cmd",
  "rename",
  "move",
  "copy",
  "secret",
]);

const isMutatingCommand = (): boolean => {
  const args = process.argv.slice(2);
  return args.some((a) => MUTATING_COMMANDS.has(a));
};

export const runCliWithLayer = (
  cachePath: string,
  secretStoreLayer: Layer.Layer<SecretStore, unknown>
): void => {
  const shell = interceptCompletions();
  const complete = interceptComplete();

  if (shell) {
    const bin = "envsec";
    Console.log(generateCompletions(shell, bin)).pipe(NodeRuntime.runMain);
    return;
  }

  if (complete) {
    handleComplete(complete.type, complete.arg, cachePath).pipe(
      Effect.provide(secretStoreLayer),
      reportErrors,
      NodeRuntime.runMain
    );
    return;
  }

  const shouldRefreshCache = isMutatingCommand();

  const program = shouldRefreshCache
    ? cli.pipe(Effect.tap(() => refreshCache(cachePath)))
    : cli;

  program.pipe(
    Effect.provide(secretStoreLayer),
    Effect.provide(NodeServices.layer),
    // Logs are diagnostics: keep them off stdout, which carries data.
    Effect.provideService(References.LogToStderr, true),
    reportErrors,
    NodeRuntime.runMain
  );
};

export const runCli = (
  customDbPath: string | undefined,
  cachePath: string
): void => {
  const dbLayer = customDbPath
    ? DatabaseConfigFrom(customDbPath)
    : DatabaseConfigDefault;

  runCliWithLayer(cachePath, SecretStore.layer(dbLayer));
};
