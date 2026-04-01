/**
 * @envsec/tui — Interactive terminal UI for envsec secrets management.
 */

import type { SecretStore } from "@envsec/core";
import { Effect } from "effect";
import { enterTUI, exitTUI } from "./components.js";
import { mainMenuView } from "./views.js";

export const runTUI = (
  context: string | null
): Effect.Effect<void, never, SecretStore> =>
  Effect.gen(function* () {
    enterTUI();

    yield* mainMenuView(context).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          exitTUI();
        })
      )
    );
  });
