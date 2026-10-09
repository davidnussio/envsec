---
"@envsec/core": patch
"@envsec/tui": patch
"envsec": patch
---

Security fixes:

- The standalone binaries (Homebrew, GitHub releases) no longer read `.env` and `bunfig.toml` from the current directory. A `.env` leaked plaintext values into `run` children even without `--inject`, and a `bunfig.toml` `preload` ran arbitrary code inside envsec, e.g. when running it in a freshly cloned repository.
- `add`, `load`, `copy`, `move`, `rename` and `rescue` refuse a key that would share a keychain item with a secret in another context (context `a` + key `b.c` and context `a.b` + key `c`), instead of silently overwriting it. Deleting one of two secrets that already collide no longer destroys the other's value.
- On Windows, `run` and `cmd run` keep `& | < >` inside `{key}` placeholder values literal instead of letting `cmd.exe` run them as extra commands.
- `env-file`, `share -o` and the TUI export create files readable only by you (0600) instead of with the default umask, and tighten an existing file they overwrite.
- `envsec env` no longer doubles backslashes in values for bash and zsh, and escapes PowerShell's typographic single quotes.
- A custom `--db` / `ENVSEC_DB` no longer changes the permissions of an existing parent directory (such as the current directory or a shared folder) to 0700.
