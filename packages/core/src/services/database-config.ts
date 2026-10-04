import { homedir } from "node:os";
import nodePath from "node:path";

import { Context, Layer } from "effect";

export interface DatabaseConfigShape {
  readonly path: string;
}

export class DatabaseConfig extends Context.Service<
  DatabaseConfig,
  DatabaseConfigShape
>()("envsec/DatabaseConfig") {}

const defaultDbPath = nodePath.join(homedir(), ".envsec", "store.sqlite");

export const DatabaseConfigDefault = Layer.succeed(DatabaseConfig, {
  path: defaultDbPath,
});

export const DatabaseConfigFrom = (path: string) =>
  Layer.succeed(DatabaseConfig, { path });
