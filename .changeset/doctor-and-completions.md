---
"@envsec/core": patch
"@envsec/tui": patch
"envsec": patch
---

Fixes for `doctor`, shell completions, durations and colour:

- `envsec doctor` no longer hangs on Linux: the keychain probe writes its value to `secret-tool store`, closes stdin, reads it back and clears it. The Windows check looks for PowerShell's `Add-Type` (P/Invoke) instead of `cmdkey`.
- zsh: `envsec -c ctx get <Tab>` completes the keys of `ctx` again; `--context=ctx` and `--db=path` are understood.
- bash: `cmd run <Tab>` and `cmd delete <Tab>` complete saved commands, `--context=ctx` works, and completion is registered on macOS's bash 3.2 (without `-o nosort`).
- fish: `cmd delete <Tab>` no longer mixes secret keys into saved command names.
- Completions use the database given with `--db`, the completion cache is refreshed after `envsec tui`, and the scripts no longer register an `esec` command.
- `--expires` and `--within` reject durations above 1000y instead of crashing with `RangeError: Invalid time value`.
- `FORCE_COLOR=0` and `FORCE_COLOR=false` turn colour off instead of on, and warnings and errors on stderr are coloured only when stderr is a terminal.
