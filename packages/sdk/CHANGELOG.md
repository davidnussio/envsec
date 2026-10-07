# @envsec/sdk

## 1.1.0

### Minor Changes

- d7e1616: Requires Node.js >= 22.13 (was >= 22), or Bun, because `@envsec/core` now uses the built-in `node:sqlite`. No API changes.
- Updated dependencies [d7e1616]
  - @envsec/core@1.1.0

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

- af62672: Migrate the core, SDK, CLI, and TUI runtimes to Effect 4.0 RC, including the unstable Effect CLI APIs and updated service, layer, schema, and runtime patterns. Add isolated end-to-end credential fixtures for safe local testing.
- Updated dependencies [f2e746c]
- Updated dependencies [f2e746c]
- Updated dependencies [99b433a]
- Updated dependencies [af62672]
  - @envsec/core@1.0.0
