import { icons } from "@envsec/core";
import { Cause, Console, Effect, Option, Runtime } from "effect";

/** Marks a failure whose message was already printed, so `runMain` only
 *  applies the exit code and does not log it again (to stdout). */
class ReportedFailureError extends Error {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode]: number;

  constructor(exitCode: number) {
    super("Failure already reported");
    this.name = "ReportedFailureError";
    this[Runtime.errorExitCode] = exitCode;
  }
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Print failures to stderr as a single line (unexpected defects with their
 * full cause), keeping stdout clean for `eval "$(envsec env)"` and pipes.
 * Errors already rendered by `effect/cli` and interruptions pass through.
 */
export const reportErrors = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, unknown, R> =>
  effect.pipe(
    Effect.catchCause((cause): Effect.Effect<never, unknown> => {
      if (Cause.hasInterruptsOnly(cause)) {
        return Effect.failCause(cause);
      }
      const squashed = Cause.squash(cause);
      if (!Runtime.getErrorReported(squashed)) {
        return Effect.failCause(cause);
      }
      const failure = Cause.findErrorOption(cause);
      const output = Option.isSome(failure)
        ? `${icons.error} ${messageOf(failure.value)}`
        : `${icons.error} Unexpected error:\n${Cause.pretty(cause)}`;
      return Console.error(output).pipe(
        Effect.andThen(
          Effect.fail(
            new ReportedFailureError(Runtime.getErrorExitCode(squashed))
          )
        )
      );
    })
  );
