import { execFileSync, spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { Command, Options } from "@effect/cli";
import { badge, bold, dim, icons, ShellNotFoundError } from "@envsec/core";
import { Console, Effect } from "effect";
import { fetchContextSecrets } from "./inject-secrets.js";
import { requireContext } from "./root.js";

const shellOption = Options.text("shell").pipe(
  Options.withAlias("s"),
  Options.withDescription(
    "Shell to spawn (bash, zsh, fish, powershell). Default: auto-detect"
  ),
  Options.optional
);

const noInherit = Options.boolean("no-inherit").pipe(
  Options.withDescription("Do not inherit parent environment variables"),
  Options.withDefault(false)
);

const quiet = Options.boolean("quiet").pipe(
  Options.withAlias("q"),
  Options.withDescription("Suppress startup/exit banner"),
  Options.withDefault(false)
);

const resolveShell = (name: string): { bin: string; args: string[] } => {
  switch (name) {
    case "bash":
      return { bin: "bash", args: ["--norc", "--noprofile"] };
    case "zsh":
      return { bin: "zsh", args: ["--no-rcs"] };
    case "fish":
      return { bin: "fish", args: [] };
    case "powershell":
    case "pwsh":
      return { bin: "pwsh", args: ["-NoExit", "-NoProfile"] };
    default:
      return { bin: name, args: [] };
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
    return { bin: shellPath, args: resolved.args };
  }
  if (process.platform === "win32") {
    return { bin: "powershell.exe", args: ["-NoExit"] };
  }
  return { bin: "/bin/sh", args: [] };
};

const shellExists = (bin: string): Effect.Effect<void, ShellNotFoundError> =>
  Effect.try({
    try: () => {
      if (path.isAbsolute(bin)) {
        accessSync(bin, constants.X_OK);
      } else {
        execFileSync("which", [bin], { stdio: "ignore" });
      }
    },
    catch: () =>
      new ShellNotFoundError({
        shell: bin,
        message: `Shell "${bin}" not found in PATH.`,
      }),
  });

/**
 * Environment variables that must never be overwritten by secret injection.
 * Overwriting these could break the shell session or create security risks
 * (e.g. PATH hijack, LD_PRELOAD injection).
 */
const PROTECTED_ENV_VARS = new Set([
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "TERM",
  "LANG",
  "IFS",
  "PWD",
  "OLDPWD",
  "TMPDIR",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
]);

const buildChildEnv = (
  ctx: string,
  secretEnv: Record<string, string>,
  bin: string,
  inherit: boolean
): Record<string, string> => {
  const parentEnv = inherit
    ? { ...process.env }
    : { PATH: process.env.PATH ?? "" };

  // Filter out secrets that would overwrite critical env vars
  const safeSecretEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(secretEnv)) {
    if (!PROTECTED_ENV_VARS.has(key)) {
      safeSecretEnv[key] = value;
    }
  }

  const childEnv: Record<string, string> = {
    ...(parentEnv as Record<string, string>),
    ...safeSecretEnv,
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
  { shell: shellOption, noInherit, quiet },
  ({ shell: shellOpt, noInherit, quiet }) =>
    Effect.gen(function* () {
      const ctx = yield* requireContext;

      const existingCtx = process.env.ENVSEC_CONTEXT;
      if (existingCtx) {
        yield* Console.error(
          `${icons.warning} Already inside an envsec shell (context: ${bold(existingCtx)}). Nesting is allowed but may cause confusion.`
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
          `${icons.shell} envsec shell ${dim("—")} context: ${bold(ctx)} (${badge(count, "secret")} loaded)`
        );
        yield* Console.error(
          `${dim("Type 'exit' or press Ctrl+D to leave the session.")}`
        );
      }

      yield* Effect.async<void, never>((resume) => {
        const child = spawn(bin, args, {
          env: childEnv,
          stdio: "inherit",
        });

        child.on("error", () => {
          resume(Effect.void);
        });

        child.on("close", (code) => {
          if (!quiet) {
            process.stderr.write(
              `${icons.arrow} Exiting envsec shell ${dim("—")} secrets cleared.\n`
            );
          }
          process.exitCode = code ?? 0;
          resume(Effect.void);
        });
      });
    })
);
