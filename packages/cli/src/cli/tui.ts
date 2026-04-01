import { Command } from "@effect/cli";
import { runTUI } from "@envsec/tui";
import { Effect, Option } from "effect";
import { optionalContext } from "./root.js";

export const tuiCommand = Command.make("tui", {}, () =>
  Effect.gen(function* () {
    const context = yield* optionalContext;
    const ctx = Option.isSome(context) ? context.value : null;
    yield* runTUI(ctx);
  })
);
