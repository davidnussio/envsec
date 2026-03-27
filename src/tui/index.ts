/**
 * TUI entry point — wires the interactive UI to SecretStore.
 */

import { Effect } from "effect";
import type { SecretStore } from "../services/secret-store.js";
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
