import { Command } from "@effect/cli";
import { addCommand } from "./add.js";
import { cmdCommand } from "./cmd.js";
import { delCommand, deleteCommand } from "./delete.js";
import { envFileCommand } from "./env-file.js";
import { getCommand } from "./get.js";
import { listCommand } from "./list.js";
import { loadCommand } from "./load.js";
import { rootCommand } from "./root.js";
import { runCommand } from "./run.js";
import { searchCommand } from "./search.js";

export const commands = rootCommand.pipe(
  Command.withSubcommands([
    addCommand,
    getCommand,
    deleteCommand,
    delCommand,
    searchCommand,
    listCommand,
    runCommand,
    envFileCommand,
    loadCommand,
    cmdCommand,
  ])
);
