# @envsec/core

## 1.0.2

### Patch Changes

- No code changes. Version aligned with `envsec` 1.0.2, the first stable CLI release (`envsec@1.0.0` / `1.0.1` cannot be published on npm).

## 1.0.0

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
