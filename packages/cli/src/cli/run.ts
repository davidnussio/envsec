import { bold, EmptyValueError, icons, SecretStore } from "@envsec/core";
import { Console, Effect, Option } from "effect";
import { Argument as Args, Command, Flag as Options } from "effect/cli";

import { executeCommand } from "./execute-command.js";
import { fetchContextSecrets } from "./inject-secrets.js";
import { readLine } from "./prompt.js";
import { resolveCommand } from "./resolve-command.js";
import { requireContext } from "./root.js";

const cmdArg = Args.String("command").pipe(
  Args.withDescription(
    "Command to execute. Use {key} placeholders for secret interpolation"
  )
);

const saveOption = Options.Boolean("save").pipe(
  Options.withAlias("s"),
  Options.withDescription("Save this command for later use"),
  Options.withDefault(false)
);

const nameOption = Options.String("name").pipe(
  Options.withAlias("n"),
  Options.withDescription("Name for the saved command"),
  Options.optional
);

const injectOption = Options.Boolean("inject").pipe(
  Options.withAlias("i"),
  Options.withDescription(
    "Inject all context secrets as environment variables (KEY.NAME → KEY_NAME)"
  ),
  Options.withDefault(false)
);

export const runCommand = Command.make(
  "run",
  // oxlint-disable-next-line sort-keys -- key order sets the argument/flag order in --help
  { cmd: cmdArg, save: saveOption, name: nameOption, inject: injectOption },
  ({ cmd, save, name, inject }) =>
    Effect.gen(function* runHandler() {
      const ctx = yield* requireContext;

      if (save) {
        const cmdName = Option.isSome(name)
          ? name.value
          : yield* readLine("Command name: ");

        if (cmdName.trim() === "") {
          return yield* new EmptyValueError({
            field: "name",
            message: "Command name cannot be empty when using --save",
          });
        }

        yield* SecretStore.saveCommand(cmdName, cmd, ctx);
        yield* Console.log(
          `${icons.save} Command ${bold(`"${cmdName}"`)} saved`
        );
      }

      const resolved = yield* resolveCommand(cmd, ctx);

      const injectedEnv = inject
        ? yield* fetchContextSecrets(ctx)
        : ({} as Record<string, string>);

      yield* executeCommand(resolved, injectedEnv);
    })
).pipe(
  Command.withDescription("Run a command with secrets interpolated or injected")
);
