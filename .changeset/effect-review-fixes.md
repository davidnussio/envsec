---
"@envsec/core": patch
"@envsec/sdk": patch
"@envsec/tui": patch
"envsec": patch
---

Fix issues found while reviewing the Effect 4 code:

- Batched operations (move, copy, rename, delete --all, load, TUI import) always persist their metadata, even when a step fails
- A failed update restores the previous secret value instead of deleting it
- Errors are printed to stderr (stdout stays clean for `eval` and pipes), and `run` / `cmd run` exit with the child's exit code
- Prompts fail instead of hanging when stdin is closed; `printf value | envsec add key` works without a trailing newline
- `--db=<path>`, `--completions=<shell>` and `--debug` now work
- Every command has a description in `--help`; `del` is an alias of `delete`
- SDK: `set(..., { expires: "30d" })` stores a real expiry; `EnvsecClient.create` validates contexts and fails early
- Linux/Windows keychain errors are no longer reported as "secret not found"; helper processes are killed on interruption
- TUI: the terminal is always restored, errors are no longer hidden by success messages, export never writes empty values
