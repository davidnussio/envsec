#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { commands } from "./cli/index.js";
import { SecretStore } from "./services/secret-store.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const cli = Command.run(commands, {
  name: "envsec",
  version: pkg.version,
});

cli(process.argv).pipe(
  Effect.provide(SecretStore.Default),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
);
