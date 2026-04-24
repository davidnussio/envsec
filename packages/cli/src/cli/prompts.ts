import { Effect } from "effect";

/**
 * Prompt the user for a yes/no confirmation.
 * Returns true if the user answers "y" or "yes", false otherwise.
 */
export const readConfirmation = (
  message: string
): Effect.Effect<boolean, Error> =>
  Effect.async((resume) => {
    process.stdout.write(`${message} [y/N] `);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    const onData = (chunk: string) => {
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      const answer = chunk.toString().trim().toLowerCase();
      resume(Effect.succeed(answer === "y" || answer === "yes"));
    };

    process.stdin.on("data", onData);
  });
