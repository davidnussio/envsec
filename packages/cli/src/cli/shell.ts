import { execFileSync, spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";

import { ShellNotFoundError, stderrUi } from "@envsec/core";
import { Console, Effect } from "effect";
import { Command, Flag as Options } from "effect/cli";

import { exitCodeForSignal } from "./execute-command.js";
import { fetchContextSecrets } from "./inject-secrets.js";
import { requireContext } from "./root.js";

const shellOption = Options.String("shell").pipe(
  Options.withAlias("s"),
  Options.withDescription(
    "Shell to spawn (bash, zsh, fish, powershell). Default: auto-detect"
  ),
  Options.optional
);

const noInheritOption = Options.Boolean("no-inherit").pipe(
  Options.withDescription("Do not inherit parent environment variables"),
  Options.withDefault(false)
);

const quietOption = Options.Boolean("quiet").pipe(
  Options.withAlias("q"),
  Options.withDescription("Suppress startup/exit banner"),
  Options.withDefault(false)
);

const resolveShell = (name: string): { bin: string; args: string[] } => {
  switch (name) {
    case "bash": {
      return { args: ["--norc", "--noprofile"], bin: "bash" };
    }
    case "zsh": {
      return { args: ["--no-rcs"], bin: "zsh" };
    }
    case "fish": {
      return { args: [], bin: "fish" };
    }
    case "powershell":
    case "pwsh": {
      return { args: ["-NoExit", "-NoProfile"], bin: "pwsh" };
    }
    default: {
      return { args: [], bin: name };
    }
  }
};

const detectShell = (override?: string): { bin: string; args: string[] } => {
  if (override) {
    return resolveShell(override);
  }
  if (process.env.SHELL) {
    const shellPath = process.env.SHELL;
    const name = path.basename(shellPath);
    const resolved = resolveShell(name);
    // Use the full path from $SHELL instead of just the name
    return { args: resolved.args, bin: shellPath };
  }
  if (process.platform === "win32") {
    return { args: ["-NoExit"], bin: "powershell.exe" };
  }
  return { args: [], bin: "/bin/sh" };
};

const shellExists = (bin: string): Effect.Effect<void, ShellNotFoundError> =>
  Effect.try({
    catch: () =>
      new ShellNotFoundError({
        message: `Shell "${bin}" not found in PATH.`,
        shell: bin,
      }),
    try: () => {
      if (path.isAbsolute(bin)) {
        accessSync(bin, constants.X_OK);
      } else {
        execFileSync("which", [bin], { stdio: "ignore" });
      }
    },
  });

const buildChildEnv = (
  ctx: string,
  secretEnv: Record<string, string>,
  bin: string,
  inherit: boolean
): Record<string, string> => {
  const parentEnv = inherit
    ? { ...process.env }
    : { PATH: process.env.PATH ?? "" };

  const childEnv: Record<string, string> = {
    ...(parentEnv as Record<string, string>),
    ...secretEnv,
    ENVSEC_CONTEXT: ctx,
  };

  const shellName = path.basename(bin);
  if (shellName === "bash" || shellName === "zsh") {
    childEnv.PS1 = `(envsec:${ctx}) ${process.env.PS1 ?? "\\u@\\h:\\w\\$ "}`;
  }

  return childEnv;
};

export const shellCommand = Command.make(
  "shell",
  // oxlint-disable-next-line sort-keys -- key order sets the flag order in --help
  { shell: shellOption, noInherit: noInheritOption, quiet: quietOption },
  ({ shell: shellOpt, noInherit, quiet }) =>
    Effect.gen(function* shellHandler() {
      const ctx = yield* requireContext;

      const existingCtx = process.env.ENVSEC_CONTEXT;
      if (existingCtx) {
        yield* Console.error(
          `${stderrUi.icons.warning} Already inside an envsec shell (context: ${stderrUi.bold(existingCtx)}). Nesting is allowed but may cause confusion.`
        );
      }

      const secretEnv = yield* fetchContextSecrets(ctx);

      const { bin, args } = detectShell(
        shellOpt._tag === "Some" ? shellOpt.value : undefined
      );
      yield* shellExists(bin);

      const childEnv = buildChildEnv(ctx, secretEnv, bin, !noInherit);

      const count = Object.keys(secretEnv).length;
      if (!quiet) {
        yield* Console.error(
          `${stderrUi.icons.shell} envsec shell ${stderrUi.dim("—")} context: ${stderrUi.bold(ctx)} (${stderrUi.badge(count, "secret")} loaded)`
        );
        yield* Console.error(
          `${stderrUi.dim("Type 'exit' or press Ctrl+D to leave the session.")}`
        );
      }

      yield* Effect.callback((resume) => {
        const child = spawn(bin, args, {
          env: childEnv,
          stdio: "inherit",
        });

        child.on("error", () => {
          resume(Effect.void);
        });

        child.on("close", (code, signal) => {
          if (!quiet) {
            process.stderr.write(
              `${stderrUi.icons.arrow} Exiting envsec shell ${stderrUi.dim("—")} secrets cleared.\n`
            );
          }
          process.exitCode = code ?? exitCodeForSignal(signal);
          resume(Effect.void);
        });
      });
    })
).pipe(
  Command.withDescription("Start a shell with the secrets in its environment")
);
