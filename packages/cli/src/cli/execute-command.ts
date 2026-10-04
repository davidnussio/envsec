import { execSync } from "node:child_process";
import { constants } from "node:os";

import { CommandExecutionError } from "@envsec/core";
import { Effect } from "effect";

import type { ResolvedCommand } from "./resolve-command.js";

const SIGNAL_EXIT_CODE_BASE = 128;
const GENERIC_FAILURE_EXIT_CODE = 1;

/**
 * Exit code for a child killed by `signal`, following the shell convention
 * of 128 + signal number (130 for SIGINT, 143 for SIGTERM).
 */
export const exitCodeForSignal = (signal: string | null): number => {
  const signalNumber =
    signal === null
      ? undefined
      : constants.signals[signal as keyof typeof constants.signals];
  return signalNumber === undefined
    ? GENERIC_FAILURE_EXIT_CODE
    : SIGNAL_EXIT_CODE_BASE + signalNumber;
};

interface ExecSyncFailure {
  readonly signal?: string | null;
  readonly status?: number | null;
}

/**
 * Map an execSync failure to a CommandExecutionError. A child killed by a
 * signal has `status: null` and `signal` set (e.g. after Ctrl-C).
 */
const toCommandExecutionError = (
  command: string,
  error: unknown
): CommandExecutionError => {
  const { signal, status } =
    typeof error === "object" && error !== null
      ? (error as ExecSyncFailure)
      : {};
  if (typeof status === "number") {
    return new CommandExecutionError({
      command,
      exitCode: status,
      message: `Command exited with code ${status}`,
    });
  }
  if (typeof signal === "string") {
    return new CommandExecutionError({
      command,
      exitCode: exitCodeForSignal(signal),
      message: `Command terminated by ${signal}`,
      signal,
    });
  }
  return new CommandExecutionError({
    command,
    exitCode: GENERIC_FAILURE_EXIT_CODE,
    message: `Command failed: ${error instanceof Error ? error.message : String(error)}`,
  });
};

/** Run a resolved command in a shell, with its output on the terminal. */
export const executeCommand = (
  resolved: ResolvedCommand,
  injectedEnv: Record<string, string> = {}
): Effect.Effect<void, CommandExecutionError> =>
  Effect.try({
    catch: (error) => toCommandExecutionError(resolved.command, error),
    try: () => {
      execSync(resolved.command, {
        env: { ...process.env, ...injectedEnv, ...resolved.env },
        shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
        stdio: "inherit",
      });
    },
  });
