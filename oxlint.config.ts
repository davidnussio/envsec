import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  // repos/ holds vendored third-party source (git subtree): never lint it.
  ignorePatterns: [...(core.ignorePatterns ?? []), "repos/**"],
});
