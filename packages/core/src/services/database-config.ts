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

export const DEFAULT_DB_DIR = nodePath.join(homedir(), ".envsec");
const defaultDbPath = nodePath.join(DEFAULT_DB_DIR, "store.sqlite");

export const DatabaseConfigDefault = Layer.succeed(DatabaseConfig, {
  path: defaultDbPath,
});

export const DatabaseConfigFrom = (path: string) =>
  Layer.succeed(DatabaseConfig, { path });
