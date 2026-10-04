# envsec

## 1.0.2

First stable release of the CLI. `envsec@1.0.0` and `1.0.1` cannot be published: those version numbers were used by an earlier, unrelated package with the same name, and npm never allows reusing them. All `@envsec/*` packages move to 1.0.2 as well so that versions stay aligned.

### Patch Changes

- Fix the install-time crash reported in #11 (`ERR_MODULE_NOT_FOUND: effect/dist/ByteSize.js`): `@effect/platform-node` depends on `@effect/platform-node-shared` through a `^` range, so npm could install a newer one requiring a newer `effect` than the exactly pinned one. `@effect/platform-node-shared` is now pinned to the same version as `effect` (4.0.0), so the CLI always installs a single, consistent Effect.
- Updated dependencies
  - @envsec/core@1.0.2
  - @envsec/tui@1.0.2

## 1.0.0

### Minor Changes

- d00dda5: `cmd run` now takes the target context from the global `--context` / `-c` flag; the dedicated `--override-context` / `-o` option is removed. A saved command still runs in the context it was saved with by default. `-c` used to be silently ignored by `cmd run` and now overrides that context, with a warning that shows both (silenced by `--quiet`). `ENVSEC_CONTEXT` is ignored by `cmd run`, so a command saved for one context never silently runs against another (for example inside `envsec shell`).

  Migration: `envsec cmd run deploy -o myapp.prod` → `envsec -c myapp.prod cmd run deploy`.

### Patch Changes

- f2e746c: Upgrade to Effect 4.0.0 stable. The CLI now imports from `effect/cli` and uses the renamed `Flag`/`Argument` constructors (`String`, `Boolean`, `Int`, `Literals`).
- f2e746c: Fix issues found while reviewing the Effect 4 code:

  - Batched operations (move, copy, rename, delete --all, load, TUI import) always persist their metadata, even when a step fails
  - A failed update restores the previous secret value instead of deleting it
  - Errors are printed to stderr (stdout stays clean for `eval` and pipes), and `run` / `cmd run` exit with the child's exit code
  - Prompts fail instead of hanging when stdin is closed; `printf value | envsec add key` works without a trailing newline
  - `--db=<path>`, `--completions=<shell>` and `--debug` now work
  - Every command has a description in `--help`; `del` is an alias of `delete`
  - SDK: `set(..., { expires: "30d" })` stores a real expiry; `EnvsecClient.create` validates contexts and fails early
  - Linux/Windows keychain errors are no longer reported as "secret not found"; helper processes are killed on interruption
  - TUI: the terminal is always restored, errors are no longer hidden by success messages, export never writes empty values

- 99b433a: Fix a crash when a command started by `run`, `cmd run` or `shell` is killed by a signal, e.g. stopping `envsec run "npm run dev"` with Ctrl-C. envsec used to print a schema validation dump (`exitCode: Expected number, actual null`). It now exits with 128 + the signal number, like a shell: 130 and no message for Ctrl-C, or 143 with a short message for SIGTERM. `shell` also used to exit with 0 in that case.
- af62672: Migrate the core, SDK, CLI, and TUI runtimes to Effect 4.0 RC, including the unstable Effect CLI APIs and updated service, layer, schema, and runtime patterns. Add isolated end-to-end credential fixtures for safe local testing.
- Updated dependencies [f2e746c]
- Updated dependencies [f2e746c]
- Updated dependencies [99b433a]
- Updated dependencies [af62672]
  - @envsec/core@1.0.0
  - @envsec/tui@1.0.0
