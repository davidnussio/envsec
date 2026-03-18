import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import initSqlJs, { type Database } from "sql.js";
import { MetadataStoreError, SecretNotFoundError } from "../errors.js";
import { MetadataStore } from "../services/metadata-store.js";

const dbDir = join(homedir(), ".secenv");
const dbPath = join(dbDir, "store.sqlite");

const initDb = async (): Promise<Database> => {
  mkdirSync(dbDir, { recursive: true });
  const SQL = await initSqlJs();
  const db = existsSync(dbPath)
    ? new SQL.Database(readFileSync(dbPath))
    : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS secrets (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      env        TEXT NOT NULL,
      key        TEXT NOT NULL,
      type       TEXT NOT NULL CHECK(type IN ('string', 'number', 'boolean')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(env, key)
    )
  `);
  persist(db);
  return db;
};

const persist = (db: Database) => {
  writeFileSync(dbPath, Buffer.from(db.export()));
};

const make = Effect.gen(function* () {
  const db = yield* Effect.tryPromise({
    try: () => initDb(),
    catch: (error) =>
      new MetadataStoreError({
        operation: "init",
        message: `Failed to initialize database: ${error}`,
      }),
  });

  return MetadataStore.of({
    upsert: Effect.fn("SqliteMetadataStore.upsert")(function* (
      env: string,
      key: string,
      type: string
    ) {
      yield* Effect.try({
        try: () => {
          db.run(
            `INSERT INTO secrets (env, key, type)
             VALUES (?, ?, ?)
             ON CONFLICT(env, key) DO UPDATE SET
               type = excluded.type,
               updated_at = datetime('now')`,
            [env, key, type]
          );
          persist(db);
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "upsert",
            message: `Failed to upsert metadata for ${env}/${key}: ${error}`,
          }),
      });
    }),

    get: Effect.fn("SqliteMetadataStore.get")(function* (
      env: string,
      key: string
    ) {
      const row = yield* Effect.try({
        try: () => {
          const stmt = db.prepare(
            "SELECT key, type, created_at, updated_at FROM secrets WHERE env = ? AND key = ?"
          );
          stmt.bind([env, key]);
          if (!stmt.step()) {
            stmt.free();
            return null;
          }
          const result = stmt.getAsObject() as {
            key: string;
            type: string;
            created_at: string;
            updated_at: string;
          };
          stmt.free();
          return result;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "get",
            message: `Failed to get metadata for ${env}/${key}: ${error}`,
          }),
      });

      if (!row) {
        return yield* new SecretNotFoundError({
          key,
          env,
          message: `Secret metadata not found: ${env}/${key}`,
        });
      }

      return row;
    }),

    remove: Effect.fn("SqliteMetadataStore.remove")(function* (
      env: string,
      key: string
    ) {
      yield* Effect.try({
        try: () => {
          db.run("DELETE FROM secrets WHERE env = ? AND key = ?", [env, key]);
          persist(db);
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "remove",
            message: `Failed to remove metadata for ${env}/${key}: ${error}`,
          }),
      });
    }),

    search: Effect.fn("SqliteMetadataStore.search")(function* (
      env: string,
      pattern: string
    ) {
      return yield* Effect.try({
        try: () => {
          const results: Array<{ key: string; type: string }> = [];
          const stmt = db.prepare(
            "SELECT key, type FROM secrets WHERE env = ? AND key GLOB ?"
          );
          stmt.bind([env, pattern]);
          while (stmt.step()) {
            results.push(stmt.getAsObject() as { key: string; type: string });
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "search",
            message: `Failed to search metadata for ${env}/${pattern}: ${error}`,
          }),
      });
    }),

    list: Effect.fn("SqliteMetadataStore.list")(function* (env: string) {
      return yield* Effect.try({
        try: () => {
          const results: Array<{
            key: string;
            type: string;
            updated_at: string;
          }> = [];
          const stmt = db.prepare(
            "SELECT key, type, updated_at FROM secrets WHERE env = ? ORDER BY key"
          );
          stmt.bind([env]);
          while (stmt.step()) {
            results.push(
              stmt.getAsObject() as {
                key: string;
                type: string;
                updated_at: string;
              }
            );
          }
          stmt.free();
          return results;
        },
        catch: (error) =>
          new MetadataStoreError({
            operation: "list",
            message: `Failed to list metadata for ${env}: ${error}`,
          }),
      });
    }),
  });
});

export const SqliteMetadataStoreLive = Layer.effect(MetadataStore, make);
