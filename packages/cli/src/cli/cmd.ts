import { execSync } from "node:child_process";

import {
  bold,
  CommandExecutionError,
  ContextName,
  dim,
  icons,
  SecretStore,
} from "@envsec/core";
import { Console, Effect, Option, Schema } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/cli";

import { fetchContextSecrets } from "./inject-secrets.js";
import { resolveCommand } from "./resolve-command.js";

// --- cmd run <name> ---

const cmdRunName = Args.String("name").pipe(
  Args.withDescription("Name of the saved command to execute")
);

const cmdRunContextOverride = Options.String("override-context").pipe(
  Options.withAlias("o"),
  Options.withDescription("Override the saved context"),
  Options.optional
);

const cmdRunQuiet = Options.Boolean("quiet").pipe(
  Options.withAlias("q"),
  Options.withDescription(
    "Suppress informational output, print only command output"
  ),
  Options.withDefault(false)
);

const cmdRunInject = Options.Boolean("inject").pipe(
  Options.withAlias("i"),
  Options.withDescription(
    "Inject all context secrets as environment variables (KEY.NAME → KEY_NAME)"
  ),
  Options.withDefault(false)
);

const cmdRunCommand = Command.make(
  "run",
  // oxlint-disable-next-line sort-keys -- key order sets the argument/flag order in --help
  {
    name: cmdRunName,
    context: cmdRunContextOverride,
    quiet: cmdRunQuiet,
    inject: cmdRunInject,
  },
  ({ name, context, quiet, inject }) =>
    Effect.gen(function* cmdRunHandler() {
      const saved = yield* SecretStore.getCommand(name);
      const rawCtx = Option.isSome(context) ? context.value : saved.context;
      const ctx = yield* Schema.decodeEffect(ContextName)(rawCtx);

      const resolved = yield* resolveCommand(saved.command, ctx, { quiet });

      const injectedEnv = inject
        ? yield* fetchContextSecrets(ctx)
        : ({} as Record<string, string>);

      yield* Effect.try({
        catch: (e) => {
          const status =
            e instanceof Error && "status" in e
              ? (e as { status: number }).status
              : 1;
          return new CommandExecutionError({
            command: resolved.command,
            exitCode: status,
            message: `Command exited with code ${status}`,
          });
        },
        try: () => {
          execSync(resolved.command, {
            env: { ...process.env, ...injectedEnv, ...resolved.env },
            shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
            stdio: "inherit",
          });
        },
      });
    })
).pipe(Command.withDescription("Run a saved command"));

// --- cmd search <pattern> ---

const cmdSearchPattern = Args.String("pattern").pipe(
  Args.withDescription("Search pattern")
);

const cmdSearchName = Options.Boolean("name").pipe(
  Options.withAlias("n"),
  Options.withDescription("Search only in command names"),
  Options.withDefault(false)
);

const cmdSearchCommand = Options.Boolean("command").pipe(
  Options.withAlias("m"),
  Options.withDescription("Search only in command strings"),
  Options.withDefault(false)
);

const cmdSearchCommandDef = Command.make(
  "search",
  // oxlint-disable-next-line sort-keys -- key order sets the argument/flag order in --help
  {
    pattern: cmdSearchPattern,
    nameOnly: cmdSearchName,
    commandOnly: cmdSearchCommand,
  },
  ({ pattern, nameOnly, commandOnly }) =>
    Effect.gen(function* cmdSearchHandler() {
      let field: "name" | "command" | "all";
      if (nameOnly) {
        field = "name";
      } else if (commandOnly) {
        field = "command";
      } else {
        field = "all";
      }
      const results = yield* SecretStore.searchCommands(pattern, field);

      if (results.length === 0) {
        yield* Console.log(`${icons.search} No commands found.`);
        return;
      }

      for (const item of results) {
        yield* Console.log(
          `${icons.bolt} ${bold(item.name)}  ${icons.arrow}  ${item.command}  ${dim(`(ctx: ${item.context})`)}`
        );
      }
    })
).pipe(Command.withDescription("Search saved commands"));

// --- cmd list ---

const cmdListCommand = Command.make("list", {}, () =>
  Effect.gen(function* cmdListHandler() {
    const results = yield* SecretStore.listCommands();

    if (results.length === 0) {
      yield* Console.log(`${icons.empty} No saved commands.`);
      return;
    }

    for (const item of results) {
      yield* Console.log(
        `${icons.bolt} ${bold(item.name)}  ${icons.arrow}  ${item.command}  ${dim(`(ctx: ${item.context})`)}`
      );
    }
  })
).pipe(Command.withDescription("List saved commands"));

// --- cmd delete <name> ---

const cmdDeleteName = Args.String("name").pipe(
  Args.withDescription("Name of the command to delete")
);

const cmdDeleteCommand = Command.make(
  "delete",
  { name: cmdDeleteName },
  ({ name }) =>
    Effect.gen(function* cmdDeleteHandler() {
      yield* SecretStore.removeCommand(name);
      yield* Console.log(`${icons.trash} Command ${bold(`"${name}"`)} removed`);
    })
).pipe(Command.withDescription("Delete a saved command"));

// --- cmd (parent) ---

export const cmdCommand = Command.make("cmd", {}).pipe(
  Command.withDescription("Manage saved commands"),
  Command.withSubcommands([
    cmdRunCommand,
    cmdSearchCommandDef,
    cmdListCommand,
    cmdDeleteCommand,
  ])
);
