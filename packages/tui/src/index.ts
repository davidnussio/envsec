/**
 * Interactive terminal UI for envsec secrets management (`@envsec/tui` package).
 */

import type { SecretStore } from "@envsec/core";
import { Effect } from "effect";

import { enterTUI, exitTUI } from "./components.js";
import { mainMenuView } from "./views.js";

/**
 * Run the TUI. Raw mode is held for the whole session (so keys typed while
 * a view redraws are not echoed) and the terminal is always restored —
 * on exit, on failure and on interruption.
 */
export const runTUI = (
  context: string | null
): Effect.Effect<void, never, SecretStore> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const wasRaw = process.stdin.isRaw;
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      enterTUI();
      return wasRaw;
    }),
    () => mainMenuView(context),
    (wasRaw) =>
      Effect.sync(() => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRaw);
        }
        process.stdin.pause();
        exitTUI();
      })
  );
