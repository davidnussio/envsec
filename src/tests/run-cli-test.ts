import { spyOn } from "bun:test";
import { Command } from "@effect/cli";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, type Layer as LayerType } from "effect";
import { commands } from "../cli/index.js";
import type { MetadataStoreError } from "../errors.js";
import type { SecretStore } from "../services/secret-store.js";

export function buildTestCli(
  secretStoreLayer: LayerType.Layer<
    SecretStore,
    MetadataStoreError | Error,
    never
  >
) {
  return (arg: string) => {
    const logs: string[] = [];

    const consoleSpy = spyOn(console, "log").mockImplementation((...args) => {
      logs.push(args.map(String).join(" "));
    });

    const run = Command.run(commands, {
      name: "envsec",
      version: "0.0.0-test",
    });

    const allLayers = Layer.mergeAll(secretStoreLayer, NodeContext.layer);

    return run(["node", "envsec", ...arg.split(" ")])
      .pipe(
        Effect.provide(allLayers),
        Effect.tapError(() => Effect.sync(() => consoleSpy.mockRestore())),
        Effect.runPromise
      )
      .finally(() => consoleSpy.mockRestore())
      .then(() => logs);
  };
}
