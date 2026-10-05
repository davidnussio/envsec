import { chmodSync, closeSync, mkdirSync, openSync } from "node:fs";
import nodePath from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import { Effect, Layer, Schema } from "effect";

import {
  CommandNotFoundError,
  MetadataStoreError,
  SecretNotFoundError,
} from "../errors.js";
import { DatabaseConfig } from "../services/database-config.js";
import { MetadataStore } from "../services/metadata-store.js";
import type {
  CommandMetadata,
  SecretMetadata,
} from "../services/metadata-store.js";

// ── Row schemas: rows read from SQLite are decoded, not cast ─────────

// oxlint-disable-next-line sort-keys -- decoded field order is the key order of rows returned to callers (e.g. `--json` output)
const SecretMetadataRow = Schema.Struct({
  key: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
  expires_at: Schema.NullOr(Schema.String),
});

const ExpiringSecretRow = Schema.Struct({
  env: Schema.String,
  ...SecretMetadataRow.fields,
});

// oxlint-disable-next-line sort-keys -- decoded field order is the key order of rows returned to callers (e.g. `--json` output)
const SecretListRow = Schema.Struct({
  key: Schema.String,
  updated_at: Schema.String,
  expires_at: Schema.NullOr(Schema.String),
});

const KeyRow = Schema.Struct({ key: Schema.String });

const ContextCountRow = Schema.Struct({
  count: Schema.Number,
  env: Schema.String,
});

// oxlint-disable-next-line sort-keys -- decoded field order is the key order of rows returned to callers (e.g. `--json` output)
const CommandRow = Schema.Struct({
  name: Schema.String,
  command: Schema.String,
  context: Schema.String,
  created_at: Schema.String,
});

// oxlint-disable-next-line sort-keys -- decoded field order is the key order of rows returned to callers (e.g. `--json` output)
const EnvExportRow = Schema.Struct({
  context: Schema.String,
  path: Schema.String,
  created_at: Schema.String,
});

const DIR_PERMISSIONS = 0o700;
const FILE_PERMISSIONS = 0o600;
/** How long a write waits for another envsec process holding the lock. */
const BUSY_TIMEOUT_MS = 5000;

const SQLITE_EXPERIMENTAL_WARNING = "SQLite is an experimental feature";

/**
 * Load `node:sqlite` (Node ≥ 22.13, Bun). Node 22 flags the module as
 * experimental and prints a warning when it loads; that would pollute the
 * CLI's stderr on every run, so this one warning is filtered out.
 */
const loadSqlite = async (): Promise<{
  readonly DatabaseSync: typeof DatabaseSync;
}> => {
  const { emitWarning } = process;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const message = typeof warning === "string" ? warning : warning.message;
    if (message.startsWith(SQLITE_EXPERIMENTAL_WARNING)) {
      return;
    }
    Reflect.apply(emitWarning, process, [warning, ...rest]);
  }) as typeof process.emitWarning;
  try {
    return await import("node:sqlite");
  } finally {
    process.emitWarning = emitWarning;
  }
};

const initDb = async (dbPath: string): Promise<DatabaseSync> => {
  const dbDir = nodePath.dirname(dbPath);
  mkdirSync(dbDir, { mode: DIR_PERMISSIONS, recursive: true });
  chmodSync(dbDir, DIR_PERMISSIONS);
  // Create the file ourselves so it never exists with the default umask
  // permissions; SQLite gives its journal files the same mode.
  closeSync(openSync(dbPath, "a", FILE_PERMISSIONS));
  chmodSync(dbPath, FILE_PERMISSIONS);

  const { DatabaseSync } = await loadSqlite();
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    db.exec(
      "CREATE TABLE IF NOT EXISTS secrets (id INTEGER PRIMARY KEY AUTOINCREMENT, env TEXT NOT NULL, key TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'string', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(env, key))"
    );
    db.exec(
      "CREATE TABLE IF NOT EXISTS commands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, command TEXT NOT NULL, context TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
    );
    db.exec(
      "CREATE TABLE IF NOT EXISTS env_exports (id INTEGER PRIMARY KEY AUTOINCREMENT, context TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
    );
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_env_exports_path ON env_exports(path)"
    );
    const cols = db
      .prepare("PRAGMA table_info(secrets)")
      .all()
      .map((column) => column.name);
    if (!cols.includes("expires_at")) {
      db.exec("ALTER TABLE secrets ADD COLUMN expires_at TEXT DEFAULT NULL");
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
};

const make = Effect.gen(function* make() {
  const { path: dbPath } = yield* DatabaseConfig;
  let batching = false;
  const db = yield* Effect.acquireRelease(
    Effect.tryPromise({
      catch: (error) =>
        new MetadataStoreError({
          cause: error,
          message: `Failed to initialize database: ${error}`,
          operation: "init",
        }),
      try: () => initDb(dbPath),
    }),
    // Commit a batch that never reached endBatch (failure or interruption),
    // so metadata stays in sync with the keychain.
    (openDb) =>
      Effect.try(() => {
        if (batching) {
          openDb.exec("COMMIT");
        }
      }).pipe(Effect.ignore, Effect.ensuring(Effect.sync(() => openDb.close())))
  );
  /** Run a query and decode every row. Throws (inside Effect.try) on SQL
   *  or decode errors. */
  const queryAll = <S extends Schema.ConstraintDecoder<unknown>>(
    schema: S,
    sql: string,
    params: SQLInputValue[] = []
  ): S["Type"][] => {
    const decode = Schema.decodeUnknownSync(schema);
    return db
      .prepare(sql)
      .all(...params)
      .map((row) => decode(row));
  };

  const queryOne = <S extends Schema.ConstraintDecoder<unknown>>(
    schema: S,
    sql: string,
    params: SQLInputValue[]
  ): S["Type"] | null => queryAll(schema, sql, params)[0] ?? null;

  /** Run a write statement; returns the number of rows it changed. */
  const execute = (sql: string, params: SQLInputValue[]): number =>
    Number(db.prepare(sql).run(...params).changes);

  return MetadataStore.of({
    beginBatch: Effect.fn("SqliteMetadataStore.beginBatch")(
      function* beginBatch() {
        if (batching) {
          return;
        }
        yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to begin batch: ${error}`,
              operation: "beginBatch",
            }),
          try: () => {
            db.exec("BEGIN IMMEDIATE");
            batching = true;
          },
        });
      }
    ),
    endBatch: Effect.fn("SqliteMetadataStore.endBatch")(function* endBatch() {
      if (!batching) {
        return;
      }
      yield* Effect.try({
        catch: (error) =>
          new MetadataStoreError({
            cause: error,
            message: `Failed to persist batched changes: ${error}`,
            operation: "endBatch",
          }),
        try: () => {
          db.exec("COMMIT");
          batching = false;
        },
      });
    }),
    get: Effect.fn("SqliteMetadataStore.get")(function* get(
      env: string,
      key: string
    ) {
      const row = yield* Effect.try({
        catch: (error) =>
          new MetadataStoreError({
            cause: error,
            message: `Failed to get metadata for ${env}/${key}: ${error}`,
            operation: "get",
          }),
        try: (): SecretMetadata | null =>
          queryOne(
            SecretMetadataRow,
            "SELECT key, created_at, updated_at, expires_at FROM secrets WHERE env = ? AND key = ?",
            [env, key]
          ),
      });
      if (!row) {
        return yield* new SecretNotFoundError({
          context: env,
          key,
          message: `Secret metadata not found: ${env}/${key}`,
        });
      }
      return row;
    }),
    getCommand: Effect.fn("SqliteMetadataStore.getCommand")(
      function* getCommand(name: string) {
        const row = yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to get command "${name}": ${error}`,
              operation: "getCommand",
            }),
          try: (): CommandMetadata | null =>
            queryOne(
              CommandRow,
              "SELECT name, command, context, created_at FROM commands WHERE name = ?",
              [name]
            ),
        });
        if (!row) {
          return yield* new CommandNotFoundError({
            message: `Command not found: "${name}"`,
            name,
          });
        }
        return row;
      }
    ),
    list: Effect.fn("SqliteMetadataStore.list")(function* list(env: string) {
      return yield* Effect.try({
        catch: (error) =>
          new MetadataStoreError({
            cause: error,
            message: `Failed to list metadata for ${env}: ${error}`,
            operation: "list",
          }),
        try: () =>
          queryAll(
            SecretListRow,
            "SELECT key, updated_at, expires_at FROM secrets WHERE env = ? ORDER BY key",
            [env]
          ),
      });
    }),
    listAllExpiring: Effect.fn("SqliteMetadataStore.listAllExpiring")(
      function* listAllExpiring(withinMs: number) {
        return yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to list all expiring secrets: ${error}`,
              operation: "listAllExpiring",
            }),
          try: () => {
            const cutoff = new Date(Date.now() + withinMs)
              .toISOString()
              .replace("T", " ")
              .replace("Z", "")
              .slice(0, 19);
            return queryAll(
              ExpiringSecretRow,
              "SELECT env, key, created_at, updated_at, expires_at FROM secrets WHERE expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at",
              [cutoff]
            );
          },
        });
      }
    ),
    listCommands: Effect.fn("SqliteMetadataStore.listCommands")(
      function* listCommands() {
        return yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to list commands: ${error}`,
              operation: "listCommands",
            }),
          try: (): CommandMetadata[] =>
            queryAll(
              CommandRow,
              "SELECT name, command, context, created_at FROM commands ORDER BY name"
            ),
        });
      }
    ),
    listContexts: Effect.fn("SqliteMetadataStore.listContexts")(
      function* listContexts() {
        return yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to list contexts: ${error}`,
              operation: "listContexts",
            }),
          try: () =>
            queryAll(
              ContextCountRow,
              "SELECT env, COUNT(*) as count FROM secrets GROUP BY env ORDER BY env"
            ).map((row) => ({ context: row.env, count: row.count })),
        });
      }
    ),
    listEnvFileExports: Effect.fn("SqliteMetadataStore.listEnvFileExports")(
      function* listEnvFileExports() {
        return yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to list env file exports: ${error}`,
              operation: "listEnvFileExports",
            }),
          try: () =>
            queryAll(
              EnvExportRow,
              "SELECT context, path, created_at FROM env_exports ORDER BY created_at DESC"
            ),
        });
      }
    ),
    listExpiring: Effect.fn("SqliteMetadataStore.listExpiring")(
      function* listExpiring(env: string, withinMs: number) {
        return yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to list expiring secrets for ${env}: ${error}`,
              operation: "listExpiring",
            }),
          try: () => {
            const cutoff = new Date(Date.now() + withinMs)
              .toISOString()
              .replace("T", " ")
              .replace("Z", "")
              .slice(0, 19);
            return queryAll(
              SecretMetadataRow,
              "SELECT key, created_at, updated_at, expires_at FROM secrets WHERE env = ? AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at",
              [env, cutoff]
            );
          },
        });
      }
    ),
    remove: Effect.fn("SqliteMetadataStore.remove")(function* remove(
      env: string,
      key: string
    ) {
      yield* Effect.try({
        catch: (error) =>
          new MetadataStoreError({
            cause: error,
            message: `Failed to remove metadata for ${env}/${key}: ${error}`,
            operation: "remove",
          }),
        try: () => {
          execute("DELETE FROM secrets WHERE env = ? AND key = ?", [env, key]);
        },
      });
    }),
    removeCommand: Effect.fn("SqliteMetadataStore.removeCommand")(
      function* removeCommand(name: string) {
        const rowsModified = yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to remove command "${name}": ${error}`,
              operation: "removeCommand",
            }),
          try: () => execute("DELETE FROM commands WHERE name = ?", [name]),
        });
        if (rowsModified === 0) {
          return yield* new CommandNotFoundError({
            message: `Command not found: "${name}"`,
            name,
          });
        }
      }
    ),
    removeEnvFileExport: Effect.fn("SqliteMetadataStore.removeEnvFileExport")(
      function* removeEnvFileExport(path: string) {
        yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to remove env file export: ${error}`,
              operation: "removeEnvFileExport",
            }),
          try: () => {
            execute("DELETE FROM env_exports WHERE path = ?", [path]);
          },
        });
      }
    ),
    saveCommand: Effect.fn("SqliteMetadataStore.saveCommand")(
      function* saveCommand(name: string, command: string, context: string) {
        yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to save command "${name}": ${error}`,
              operation: "saveCommand",
            }),
          try: () => {
            execute(
              "INSERT INTO commands (name, command, context) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET command = excluded.command, context = excluded.context",
              [name, command, context]
            );
          },
        });
      }
    ),
    search: Effect.fn("SqliteMetadataStore.search")(function* search(
      env: string,
      pattern: string
    ) {
      return yield* Effect.try({
        catch: (error) =>
          new MetadataStoreError({
            cause: error,
            message: `Failed to search metadata for ${env}/${pattern}: ${error}`,
            operation: "search",
          }),
        try: () =>
          queryAll(
            KeyRow,
            "SELECT key FROM secrets WHERE env = ? AND key GLOB ?",
            [env, pattern]
          ),
      });
    }),
    searchCommands: Effect.fn("SqliteMetadataStore.searchCommands")(
      function* searchCommands(
        pattern: string,
        field: "name" | "command" | "all"
      ) {
        return yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to search commands for "${pattern}": ${error}`,
              operation: "searchCommands",
            }),
          try: (): CommandMetadata[] => {
            let query: string;
            if (field === "name") {
              query =
                "SELECT name, command, context, created_at FROM commands WHERE name GLOB ? ORDER BY name";
            } else if (field === "command") {
              query =
                "SELECT name, command, context, created_at FROM commands WHERE command GLOB ? ORDER BY name";
            } else {
              query =
                "SELECT name, command, context, created_at FROM commands WHERE name GLOB ? OR command GLOB ? ORDER BY name";
            }
            return queryAll(
              CommandRow,
              query,
              field === "all" ? [pattern, pattern] : [pattern]
            );
          },
        });
      }
    ),
    searchContexts: Effect.fn("SqliteMetadataStore.searchContexts")(
      function* searchContexts(pattern: string) {
        return yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to search contexts for ${pattern}: ${error}`,
              operation: "searchContexts",
            }),
          try: () =>
            queryAll(
              ContextCountRow,
              "SELECT env, COUNT(*) as count FROM secrets WHERE env GLOB ? GROUP BY env ORDER BY env",
              [pattern]
            ).map((row) => ({ context: row.env, count: row.count })),
        });
      }
    ),
    trackEnvFileExport: Effect.fn("SqliteMetadataStore.trackEnvFileExport")(
      function* trackEnvFileExport(context: string, path: string) {
        yield* Effect.try({
          catch: (error) =>
            new MetadataStoreError({
              cause: error,
              message: `Failed to track env file export: ${error}`,
              operation: "trackEnvFileExport",
            }),
          try: () => {
            execute(
              "INSERT INTO env_exports (context, path) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET context = excluded.context, created_at = datetime('now')",
              [context, path]
            );
          },
        });
      }
    ),
    upsert: Effect.fn("SqliteMetadataStore.upsert")(function* upsert(
      env: string,
      key: string,
      expiresAt?: string | null
    ) {
      yield* Effect.try({
        catch: (error) =>
          new MetadataStoreError({
            cause: error,
            message: `Failed to upsert metadata for ${env}/${key}: ${error}`,
            operation: "upsert",
          }),
        try: () => {
          execute(
            "INSERT INTO secrets (env, key, type, expires_at) VALUES (?, ?, 'string', ?) ON CONFLICT(env, key) DO UPDATE SET updated_at = datetime('now'), expires_at = ?",
            [env, key, expiresAt ?? null, expiresAt ?? null]
          );
        },
      });
    }),
  });
});

export const SqliteMetadataStoreLive = Layer.effect(MetadataStore, make);
