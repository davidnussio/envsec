import { AbortedError } from "@envsec/core";
import { Effect } from "effect";

const isNewline = (ch: string): boolean => ch === "\r" || ch === "\n";
const isInterrupt = (ch: string): boolean => ch === "\u0003";
const isBackspace = (ch: string): boolean => ch === "\u007F" || ch === "\b";

const stdinClosed = () =>
  new AbortedError({
    message: "No input received: stdin is closed",
  });

/**
 * Read one line from stdin.
 *
 * - Resolves on newline, or on end of input with whatever was typed/piped
 *   (so `printf value | envsec add key` works without a trailing newline).
 * - Fails with AbortedError on Ctrl-C (masked mode) or when stdin is closed
 *   before any input arrives, instead of waiting forever.
 * - Restores listeners, raw mode and the paused state on completion and on
 *   interruption.
 */
const readInput = (
  prompt: string,
  options: { readonly masked: boolean }
): Effect.Effect<string, AbortedError> =>
  Effect.callback((resume) => {
    const { stdin } = process;
    process.stdout.write(prompt);

    if (stdin.readableEnded) {
      resume(Effect.fail(stdinClosed()));
      return;
    }

    // Raw mode and `*` echo only make sense on an interactive terminal.
    const useRawMode = options.masked && stdin.isTTY;
    const wasRaw = stdin.isRaw;
    if (useRawMode) {
      stdin.setRawMode(true);
    }
    stdin.setEncoding("utf-8");
    stdin.resume();

    let input = "";
    let done = false;
    // Filled in once the stdin listeners are attached (they are defined after
    // `finish`, which needs to detach them).
    const detachListeners: (() => void)[] = [];

    const cleanup = () => {
      for (const detach of detachListeners) {
        detach();
      }
      if (useRawMode) {
        stdin.setRawMode(wasRaw);
      }
      stdin.pause();
    };

    const echo = (text: string) => {
      if (useRawMode) {
        process.stdout.write(text);
      }
    };

    const finish = (result: Effect.Effect<string, AbortedError>) => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      echo("\n");
      resume(result);
    };

    const eraseLastChar = () => {
      if (input.length > 0) {
        input = input.slice(0, -1);
        echo("\b \b");
      }
    };

    const handleChar = (ch: string) => {
      if (isNewline(ch)) {
        finish(Effect.succeed(input));
      } else if (options.masked && isInterrupt(ch)) {
        finish(
          Effect.fail(new AbortedError({ message: "User aborted input" }))
        );
      } else if (options.masked && isBackspace(ch)) {
        eraseLastChar();
      } else {
        input += ch;
        echo("*");
      }
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        handleChar(ch);
        if (done) {
          return;
        }
      }
    };

    const onEnd = () => {
      finish(input === "" ? Effect.fail(stdinClosed()) : Effect.succeed(input));
    };

    const onError = (cause: Error) => {
      finish(
        Effect.fail(
          new AbortedError({ message: `Cannot read input: ${cause.message}` })
        )
      );
    };

    stdin.on("data", onData);
    stdin.on("end", onEnd);
    stdin.on("error", onError);
    detachListeners.push(
      () => stdin.removeListener("data", onData),
      () => stdin.removeListener("end", onEnd),
      () => stdin.removeListener("error", onError)
    );

    return Effect.sync(() => {
      done = true;
      cleanup();
    });
  });

/** Read a visible line of input (trimmed). */
export const readLine = (prompt: string): Effect.Effect<string, AbortedError> =>
  readInput(prompt, { masked: false }).pipe(Effect.map((s) => s.trim()));

/** Read a secret value, echoing `*` for each character on a TTY. */
export const readSecret = (
  prompt: string
): Effect.Effect<string, AbortedError> => readInput(prompt, { masked: true });

/** Ask a y/N question. Fails if stdin is closed: pass --yes in scripts. */
export const readConfirmation = (
  message: string
): Effect.Effect<boolean, AbortedError> =>
  readLine(`${message} [y/N] `).pipe(
    Effect.map((answer) => {
      const normalized = answer.toLowerCase();
      return normalized === "y" || normalized === "yes";
    }),
    Effect.mapError(
      (aborted) =>
        new AbortedError({
          message: `${aborted.message}. Use --yes to skip the confirmation prompt.`,
        })
    )
  );
