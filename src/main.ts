#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Logger, LogLevel } from "effect";
import { commands } from "./cli/index.js";
import { SecretStore } from "./services/secret-store.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

const cli = Command.run(commands, {
  name: "envsec",
  version: pkg.version,
});

const debugFlag =
  process.argv.includes("-d") || process.argv.includes("--debug");

const logLayer = debugFlag
  ? Logger.minimumLogLevel(LogLevel.All)
  : Logger.minimumLogLevel(LogLevel.None);

cli(process.argv).pipe(
  Effect.provide(SecretStore.Default),
  Effect.provide(NodeContext.layer),
  Effect.provide(Layer.mergeAll(logLayer)),
  NodeRuntime.runMain
);
