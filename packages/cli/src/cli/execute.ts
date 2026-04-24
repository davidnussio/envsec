import { execSync } from "node:child_process";
import { CommandExecutionError } from "@envsec/core";
import { Effect } from "effect";
import type { ResolvedCommand } from "./resolve-command.js";

/**
 * Execute a resolved command with secret values injected via environment variables.
 *
 * On Windows, uses PowerShell instead of cmd.exe to avoid %VAR% macro-expansion
 * which is vulnerable to shell injection via secret values containing & | > etc.
 */
export const executeCommand = (
  resolved: ResolvedCommand,
  injectedEnv: Record<string, string> = {}
): Effect.Effect<void, CommandExecutionError> =>
  Effect.try({
    try: () => {
      execSync(resolved.command, {
        stdio: "inherit",
        shell: process.platform === "win32" ? "powershell.exe" : "/bin/sh",
        env: { ...process.env, ...injectedEnv, ...resolved.env },
      });
    },
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
  });
