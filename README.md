# envsec

Secure environment secrets management using native OS credential stores.

## Demo

<!-- https://github.com/user-attachments/assets/ce744e1f-7a6f-4571-8bdc-9dc63cf42ed8 -->

![Image](https://raw.githubusercontent.com/davidnussio/envsec/328e0773aad6a4c10f399f40f1a750904df334c3/assets/terminal-1.gif)

## Features

- Store secrets in your OS native credential store (not plain text files)
- Cross-platform: macOS, Linux, Windows
- Organize secrets by context (e.g. `myapp.dev`, `stripe-api.prod`, `work.staging`)
- Track secret metadata (key names, timestamps) via SQLite
- Search contexts and secrets with glob patterns
- Run commands with secret interpolation
- Save and rerun commands with `cmd` (search, list, run, delete)
- Export secrets to `.env` files (with generation tracking via `audit`)
- Export secrets as shell environment variables (`eval "$(envsec env)"`)
- Load secrets from `.env` files (with conflict detection)
- Rescue every plaintext `.env` file in a directory tree into the keychain (`envsec rescue ~/projects --import`)
- Share secrets encrypted with GPG for team members
- Interactive terminal UI (`envsec tui`) for managing secrets without memorizing commands

## Packages

This is a monorepo containing the following packages:

| Package | Description | npm |
| --- | --- | --- |
| [`envsec`](./packages/cli) | CLI tool for managing secrets | [![npm](https://img.shields.io/npm/v/envsec)](https://www.npmjs.com/package/envsec) |
| [`@envsec/sdk`](./packages/sdk) | Node.js / Bun SDK for loading secrets programmatically | [![npm](https://img.shields.io/npm/v/@envsec/sdk)](https://www.npmjs.com/package/@envsec/sdk) |
| [`@envsec/core`](./packages/core) | Core engine — OS credential store adapters + metadata DB | [![npm](https://img.shields.io/npm/v/@envsec/core)](https://www.npmjs.com/package/@envsec/core) |
| [`@envsec/tui`](./packages/tui) | Interactive terminal UI for secrets management | [![npm](https://img.shields.io/npm/v/@envsec/tui)](https://www.npmjs.com/package/@envsec/tui) |

## SDK Quick Start

For programmatic access to secrets from Node.js or Bun, use `@envsec/sdk`:

```bash
npm install @envsec/sdk
```

```typescript
import { loadSecrets } from "@envsec/sdk";

// Load and inject into process.env
await loadSecrets({ context: "myapp.dev", inject: true });

// Or use the client for full control
import { EnvsecClient } from "@envsec/sdk";
const client = await EnvsecClient.create({ context: "myapp.dev" });
const apiKey = await client.get("api.key");
await client.close();
```

See the full [SDK documentation](./packages/sdk/README.md) for all APIs, multi-context support, and options.

## Requirements

- Node.js >= 22.13 — only for npm, npx and mise installs. Homebrew and the standalone binaries embed their own runtime.

### macOS

No extra dependencies. Uses the built-in Keychain via the `security` CLI tool.

### Linux

Requires `libsecret-tools` (provides the `secret-tool` command), which talks to GNOME Keyring, KDE Wallet, or any Secret Service API provider via D-Bus.

```bash
# Debian / Ubuntu
sudo apt install libsecret-tools

# Fedora
sudo dnf install libsecret

# Arch
sudo pacman -S libsecret
```

A running D-Bus session and a keyring daemon (e.g. `gnome-keyring-daemon`) must be active. Most desktop environments handle this automatically.

### Windows

No extra dependencies. Uses the built-in Windows Credential Manager, calling the Win32 `CredWriteW` / `CredReadW` / `CredDeleteW` APIs from PowerShell (P/Invoke).

## Installation

### Homebrew (macOS / Linux)

Installs the standalone binary (no Node.js), with shell completions for bash, zsh and fish.

```bash
brew tap davidnussio/homebrew-tap
brew install envsec
```

### npm

```bash
npm install -g envsec
```

### npx (no install)

```bash
npx envsec
```

### mise

```bash
mise use -g npm:envsec
```

### Standalone binary (no Node.js)

Every [GitHub release](https://github.com/davidnussio/envsec/releases) ships self-contained executables for macOS (arm64, x64), Linux (x64, arm64, glibc and musl) and Windows (x64), plus a `SHA256SUMS` file:

```bash
TARGET=darwin-arm64   # or darwin-x64, linux-x64, linux-arm64, linux-x64-musl, linux-arm64-musl
curl -fsSL "https://github.com/davidnussio/envsec/releases/latest/download/envsec-${TARGET}.tar.gz" | tar -xz envsec
sudo mv envsec /usr/local/bin/
```

On Windows, download `envsec-windows-x64.zip` and put `envsec.exe` on your `PATH`.

### Beta channel

Prereleases (`vX.Y.Z-beta.N`) are published on npm under the `beta` dist-tag and on Homebrew as a separate `envsec-beta` formula. It conflicts with `envsec`, since both install the `envsec` command:

```bash
npm install -g envsec@beta

brew uninstall envsec   # if the stable formula is installed
brew install davidnussio/tap/envsec-beta
```

Go back to stable with `npm install -g envsec@latest`, or `brew uninstall envsec-beta && brew install envsec`.

## Usage

Most commands require a context specified with `--context` (or `-c`). A context is a free-form label for grouping secrets — e.g. `myapp.dev`, `stripe-api.prod`, `work.staging`.

### Global options

These options are available on all commands:

- `--context`, `-c` — Context name (e.g. `myapp.dev`, `stripe-api.prod`). Also reads `ENVSEC_CONTEXT` env var
- `--debug`, `-d` — Enable debug logging
- `--json` — Output in JSON format for scripting
- `--db` — Path to SQLite database file (default: `~/.envsec/store.sqlite`). Also reads `ENVSEC_DB` env var

### Custom database path

By default, metadata is stored at `~/.envsec/store.sqlite`. You can override this with `--db` or the `ENVSEC_DB` environment variable:

```bash
# Use a project-local database
envsec --db ./local-store.sqlite -c myapp.dev list

# Or via environment variable
export ENVSEC_DB=/shared/team/envsec.sqlite
envsec -c myapp.dev list
```

The `--db` flag takes precedence over `ENVSEC_DB`. Use cases include per-project databases, team-shared databases on network drives, and CI/CD with ephemeral storage.

### Add a secret

Store a secret in the OS credential store.

- `<key>` — Secret key name (e.g. `api.key`, `db.password`)
- `--value`, `-v` — Value to store (omit for interactive masked prompt)
- `--expires`, `-e` — Expiry duration (e.g. `30m`, `2h`, `7d`, `4w`, `3mo`, `1y`)

```bash
# Store a value inline
envsec -c myapp.dev add api.key --value "sk-abc123"

# Or use the short alias
envsec -c myapp.dev add api.key -v "sk-abc123"

# Omit --value for an interactive masked prompt
envsec -c myapp.dev add api.key

# Set an expiry duration with --expires (-e)
envsec -c myapp.dev add api.key -v "sk-abc123" --expires 30d

# Supported duration units: m (minutes), h (hours), d (days), w (weeks),
# mo (months, counted as 30 days), y (years, counted as 365 days)
# Combinable: 1y6mo, 2w3d, 1d12h
envsec -c myapp.dev add api.key -v "sk-abc123" -e 6mo
```

### Get a secret

Retrieve a secret value from the OS credential store.

- `<key>` — Secret key name to retrieve
- `--quiet`, `-q` — Print only the raw value (no warnings or extra output)
- `--json` — Output in JSON format (includes context, key, value, expires_at)

```bash
envsec -c myapp.dev get api.key

# Print only the raw value (no warnings or extra output)
envsec -c myapp.dev get api.key --quiet
envsec -c myapp.dev get api.key -q
```

### Delete a secret

Remove a secret from the OS credential store.

- `<key>` — Secret key name to delete (optional if `--all` is used)
- `--yes`, `-y` — Skip confirmation prompt
- `--all` — Delete all secrets in the context

```bash
envsec -c myapp.dev delete api.key

# or use the alias
envsec -c myapp.dev del api.key
```

### Rename a secret

Rename a secret key within the same context. The value and expiry metadata are preserved.

- `<old-key>` — Current secret key name
- `<new-key>` — New secret key name
- `--force`, `-f` — Overwrite target if it already exists

```bash
# Rename a key
envsec -c myapp.dev rename old.key new.key

# Overwrite target if it already exists
envsec -c myapp.dev rename old.key existing.key --force
```

### List all secrets in a context

List all secret keys and metadata in a context.

- `--json` — Output in JSON format

```bash
envsec -c myapp.dev list
```

### List all contexts

List all available contexts with secret counts.

- `--json` — Output in JSON format

```bash
# Without --context, lists all available contexts with secret counts
envsec list
```

### Search secrets

Search secrets or contexts using glob patterns.

- `<pattern>` — Glob pattern to search for (e.g. `api.*`, `myapp.*`)
- `--json` — Output in JSON format

```bash
# Search secrets within a context
envsec -c myapp.dev search "api.*"

# Search contexts by pattern (without --context)
envsec search "myapp.*"
```

### Move secrets between contexts

Move secrets from one context to another. The source secrets are removed after moving.

- `<pattern>` — Glob pattern or exact key to move (optional if `--all` is used)
- `--to`, `-t` — Target context to move secrets to
- `--all` — Move all secrets from source context
- `--force`, `-f` — Overwrite existing secrets in the target context
- `--yes`, `-y` — Skip confirmation prompt

```bash
# Move a single secret
envsec -c myapp.dev move api.token --to myapp.prod

# Move secrets matching a glob pattern
envsec -c myapp.dev move "redis.*" --to myapp.prod -y

# Move all secrets from one context to another
envsec -c myapp.dev move --all --to myapp.prod -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev move "redis.*" --to myapp.prod --force -y
```

### Copy secrets between contexts

Copy secrets from one context to another. The source secrets remain intact.

- `<pattern>` — Glob pattern or exact key to copy (optional if `--all` is used)
- `--to`, `-t` — Target context to copy secrets to
- `--all` — Copy all secrets from source context
- `--force`, `-f` — Overwrite existing secrets in the target context
- `--yes`, `-y` — Skip confirmation prompt

```bash
# Copy a single secret
envsec -c myapp.dev copy api.token --to myapp.staging

# Copy secrets matching a glob pattern
envsec -c myapp.dev copy "redis.*" --to myapp.staging -y

# Copy all secrets from one context to another
envsec -c myapp.dev copy --all --to myapp.staging -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev copy "redis.*" --to myapp.staging --force -y
```

### Run a command with secrets

Execute a command with secret values interpolated via placeholders or injected as environment variables.

- `<command>` — Command to execute. Use `{key}` placeholders for secret interpolation
- `--inject`, `-i` — Inject all context secrets as environment variables (`KEY.NAME` → `KEY_NAME`)
- `--save`, `-s` — Save this command for later use
- `--name`, `-n` — Name for the saved command (prompted interactively if omitted with `--save`)

```bash
# Placeholders {key} are resolved with secret values before execution
envsec -c myapp.dev run 'curl {api.url} -H "Authorization: Bearer {api.token}"'

# Any {dotted.key} in the command string is replaced with its value
envsec -c myapp.prod run 'psql {db.connection_string}'

# Inject ALL context secrets as environment variables (KEY.NAME → KEY_NAME)
envsec -c myapp.dev run --inject 'node server.js'
envsec -c myapp.dev run -i 'docker compose up'

# Combine --inject with placeholders
envsec -c myapp.dev run --inject 'curl {api.url} -H "Authorization: Bearer $API_TOKEN"'

# Save the command for later use with --save (-s) and --name (-n)
envsec -c myapp.dev run --save --name deploy 'kubectl apply -f - <<< {k8s.manifest}'

# If you use --save without --name, you'll be prompted interactively
envsec -c myapp.dev run --save 'psql {db.connection_string}'
```

If any placeholder references a secret that doesn't exist, the command won't execute and you'll see a clear error:

```
❌ Missing secrets in context "myapp.dev":
  - api.url
  - api.token

Add them with: envsec -c myapp.dev add <key>
```

### Saved commands

Saved commands live under the `cmd` subcommand, keeping them separate from secret operations.

#### cmd list

List all saved commands.

```bash
envsec cmd list
```

#### cmd run

Run a saved command. It runs in the context it was saved with, unless you pass `--context` / `-c` explicitly; envsec then prints a warning showing both contexts (silenced by `--quiet`). `ENVSEC_CONTEXT` is ignored here, so a command saved for one context never silently runs against another (for example inside `envsec shell`).

- `<name>` — Name of the saved command to execute
- `--quiet`, `-q` — Suppress informational output (print only command output)
- `--inject`, `-i` — Inject all context secrets as environment variables

```bash
envsec cmd run deploy

# Run quietly (suppress informational output like "Resolved N secret(s)")
envsec cmd run deploy --quiet
envsec cmd run deploy -q

# Run in a different context than the one it was saved with
envsec -c myapp.prod cmd run deploy

# Inject all context secrets as env vars when running a saved command
envsec cmd run deploy --inject
envsec cmd run deploy -i
```

#### cmd search

Search saved commands by name or command string.

- `<pattern>` — Search pattern
- `--name`, `-n` — Search only in command names
- `--command`, `-m` — Search only in command strings

```bash
envsec cmd search psql

# Search only by name
envsec cmd search deploy -n

# Search only by command string
envsec cmd search kubectl -m
```

#### cmd delete

Delete a saved command.

- `<name>` — Name of the command to delete

```bash
envsec cmd delete deploy
```

### Generate a .env file

Export all secrets from a context to a `.env` file.

- `--output`, `-o` — Output file path (default: `.env`)

```bash
# Creates .env with all secrets from the context
envsec -c myapp.dev env-file

# Specify a custom output path
envsec -c myapp.dev env-file --output .env.local
```

Keys are converted to `UPPER_SNAKE_CASE` (e.g. `api.token` → `API_TOKEN`).

### Export secrets as environment variables

Output export statements for use with `eval` or shell sourcing.

- `--shell`, `-s` — Target shell syntax: `bash` (default), `zsh`, `fish`, `powershell`
- `--unset`, `-u` — Output unset/remove commands instead of export

```bash
# Output export statements for eval (bash/zsh)
eval "$(envsec -c myapp.dev env)"

# Specify target shell syntax
envsec -c myapp.dev env --shell fish
envsec -c myapp.dev env --shell powershell

# Output unset commands to clean up exported variables
eval "$(envsec -c myapp.dev env --unset)"

# Combine shell and unset
envsec -c myapp.dev env --unset --shell fish
```

Supported shells: `bash` (default), `zsh`, `fish`, `powershell`. Keys are converted to `UPPER_SNAKE_CASE` (e.g. `api.token` → `API_TOKEN`). Output goes to stdout so it can be piped to `eval` or sourced directly — no file is written to disk.

### Start a secrets-scoped shell session

Spawn an interactive subshell with all secrets from the context injected as environment variables. When you `exit`, the secrets are gone — no cleanup needed.

- `--shell`, `-s` — Shell to spawn (`bash`, `zsh`, `fish`, `powershell`). Default: auto-detect
- `--no-inherit` — Do not inherit parent environment variables
- `--quiet`, `-q` — Suppress startup/exit banner

```bash
envsec -c myapp.dev shell
```

```
▶ envsec shell — context: myapp.dev (8 secrets loaded)
Type 'exit' or press Ctrl+D to leave the session.

(envsec:myapp.dev) ~ $ echo $DATABASE_URL
postgres://user:pass@localhost/mydb

(envsec:myapp.dev) ~ $ exit
→ Exiting envsec shell — secrets cleared.
```

```bash
# Force a specific shell
envsec -c myapp.dev shell --shell zsh

# Only envsec secrets in env (no parent variables, except PATH)
envsec -c myapp.dev shell --no-inherit

# Suppress the startup/exit banner
envsec -c myapp.dev shell --quiet
```

The variable `ENVSEC_CONTEXT` is always set inside the session, so you can reference it in scripts or prompt customizations.

### Load secrets from a .env file

Import secrets from a `.env` file into a context.

- `--input`, `-i` — Input `.env` file path (default: `.env`)
- `--force`, `-f` — Overwrite existing secrets without prompting
- `--batch`, `-b` — Batch mode: defer database persistence until all secrets are imported

```bash
# Import secrets from .env into the context
envsec -c myapp.dev load

# Specify a custom input file
envsec -c myapp.dev load --input .env.local

# Overwrite existing secrets without warning
envsec -c myapp.dev load --force
```

Keys are converted from `UPPER_SNAKE_CASE` to `dotted.lowercase` (e.g. `API_TOKEN` → `api.token`). If a key already exists, it is skipped with a warning unless `--force` (`-f`) is provided.

### Rescue every .env file in a directory tree

Scan a directory recursively, find every plaintext `.env` file and move its secrets into the OS keychain. By default `rescue` only reports what it found and changes nothing: you review the report, then run it again with `--import` and, when you are ready, `--remove-plaintext`.

```bash
# Report what is there (changes nothing)
envsec rescue ~/projects

# Import the secrets into the keychain
envsec rescue ~/projects --import

# Delete the plaintext files whose secrets are verified in the keychain
envsec rescue ~/projects --remove-plaintext

# Or both in one go
envsec rescue ~/projects --import --remove-plaintext
```

- `--import`, `-i`: Import the secrets into the keychain (without it, `rescue` only reports)
- `--remove-plaintext`: Delete each `.env` file whose secrets are all verified in the keychain
- `--force`, `-f`: With `--import`, overwrite secrets already in the keychain with a different value
- `--no-gitignore`: Do not add the `.env` files to `.gitignore`
- `--depth`: Maximum directory depth to scan (default: `8`)

How it works:

- **Finds** `.env`, `.env.local`, `.env.<mode>` and `.env.<mode>.local` files. Templates (`.env.example`, `.env.sample`, `.env.template`…) and directories such as `node_modules`, `.git`, `dist` and `vendor` are skipped, and so are files generated by `envsec env-file`.
- **Groups by project**: the nearest directory with a `.git`, `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`… is the project.
- **Proposes contexts** as `<project>.<mode>`: `.env` and `.env.local` go to `<project>.dev`, `.env.production` to `<project>.prod`, `.env.staging` to `<project>.staging`. Files of the same mode are layered like Vite and Next.js do (`.env` < `.env.local` < `.env.<mode>` < `.env.<mode>.local`).
- **Detects duplicates**: the same value used in more than one place (e.g. one API key copied into five projects) is reported by name, never by value. Files committed to git are flagged too: their secrets are in the history and should be rotated.
- **Imports** with the same key mapping as `load` (`API_TOKEN` → `api.token`). Secrets already in the keychain with the same value count as secured, so running `rescue` again is safe; a different value is reported as a conflict and kept unless you pass `--force`.
- **Updates `.gitignore`** at the root of each git repository (with `--import` or `--remove-plaintext`) so the files cannot be committed later.
- **Deletes only with `--remove-plaintext`**, and only files whose every value is in the keychain exactly as written, checked by reading it back. A file is kept (with the reason printed) when a value is not imported yet, a variable name cannot be stored, or a value is overridden by another file.

```text
✔ 143 secrets secured · 26 plaintext files removed
```

### Share secrets (GPG encrypted)

Encrypt all secrets from a context for a team member using GPG.

- `--encrypt-to` — GPG recipient key (email, key ID, or fingerprint) to encrypt for
- `--output`, `-o` — Output file path (default: stdout). Use `-` for stdout explicitly
- `--json` — Use JSON format inside the encrypted payload (default: `.env` format)

```bash
# Encrypt all secrets from a context for a team member
envsec -c myapp.dev share --encrypt-to alice@example.com

# Save encrypted output to a file
envsec -c myapp.dev share --encrypt-to alice@example.com -o secrets.enc

# Use JSON format inside the encrypted payload
envsec -c myapp.dev --json share --encrypt-to alice@example.com -o secrets.enc
```

The recipient can decrypt with `gpg --decrypt secrets.enc`. `load` reads a file path (`--input`), not stdin, so a plain pipe does not work: on macOS and Linux import the default `.env` payload with process substitution, `envsec -c myapp.dev load --input <(gpg --decrypt secrets.enc)`; on Windows decrypt to a file, load it, then delete it. By default the encrypted payload uses `.env` format (`KEY="value"`); with `--json` it uses a structured JSON object. Requires GPG to be installed and the recipient's public key to be in your keyring.

### Audit secrets for expiry

Check for expired or expiring secrets and tracked `.env` file exports.

- `--within`, `-w` — Show secrets expiring within this duration (default: `30d`). Use `0d` to show only already-expired
- `--json` — Output in JSON format

```bash
# Check for expired or expiring secrets in a context (default window: 30 days)
envsec -c myapp.dev audit

# Specify a custom window
envsec -c myapp.dev audit --within 7d

# Show only already-expired secrets
envsec -c myapp.dev audit --within 0d

# Audit across all contexts (omit --context)
envsec audit

# JSON output
envsec -c myapp.dev audit --json
```

Secrets with an `--expires` duration set via `envsec add` are tracked in metadata. The `audit` command scans for secrets that are already expired or will expire within the specified window. The `get` and `list` commands also display expiry warnings inline.

The `audit` command also tracks generated `.env` files. Every time `env-file` is used, the output path, context, and timestamp are recorded. The audit output includes a second section listing these files. If a tracked `.env` file no longer exists on disk, audit automatically removes it from the metadata and reports the cleanup.

### Generate a random secret

Generate a cryptographically secure random secret, optionally storing it.

- `<key>` — Secret key name (optional; omit for standalone password generation)
- `--length`, `-l` — Length of the generated secret (default: `32`)
- `--prefix`, `-p` — Prefix to prepend to the generated secret (e.g. `sk_`)
- `--expires`, `-e` — Expiry duration (e.g. `30m`, `2h`, `7d`, `4w`, `3mo`, `1y`)
- `--alphanumeric`, `-a` — Use only alphanumeric characters `[a-zA-Z0-9]` (default)
- `--special`, `-s` — Include common special characters `[a-zA-Z0-9!@#$%^&*]`
- `--all-chars`, `-A` — Use 93 printable ASCII characters: letters, digits and all punctuation except backslash (no space)

```bash
# Generate and store a 32-char alphanumeric secret
envsec -c myapp.dev secret api.key

# Custom length and prefix
envsec -c myapp.dev secret api.key --prefix "sk_" --length 48

# Character sets:
#   --alphanumeric (-a)  [a-zA-Z0-9] (default)
#   --special (-s)       [a-zA-Z0-9] + !@#$%^&*
#   --all-chars (-A)     printable ASCII except space and backslash (93 chars)
envsec -c myapp.dev secret db.password --special --length 64

# With expiry
envsec -c myapp.dev secret api.key --prefix "sk_" -l 48 --expires 90d

# Standalone password generator (no store, just print)
envsec secret --length 32
envsec secret --special --length 64 --prefix "pk_"
```

When both context and key are provided, the generated value is stored and printed. If either one is missing, nothing is stored: the raw value goes to stdout with no warning — useful for piping to `pbcopy`, `xclip`, or other tools, but double-check both are set when you mean to store it.

### Interactive TUI

envsec includes a full-screen terminal UI for managing secrets interactively — no need to memorize commands.

```bash
# Launch the TUI
envsec tui

# Launch with a pre-selected context
envsec -c myapp.dev tui
```

The TUI provides eight screens accessible from the main menu:

- **Contexts** — browse all contexts, set active context with `s`, clear context with `x`, view secret counts, delete entire contexts
- **Secrets** — list secrets in a table, reveal values, add or delete secrets
- **Add Secret** — interactive form with masked input and optional expiry duration
- **Search** — glob pattern search across secrets or contexts
- **Saved Commands** — list, view, and delete saved command templates
- **Audit** — check for expired/expiring secrets, review tracked `.env` file exports
- **Import .env** — load secrets from a `.env` file into the current context
- **Export .env** — export secrets to a `.env` file (tracked for audit)

Keyboard shortcuts:

| Key       | Action                                         |
| --------- | ---------------------------------------------- |
| `↑` / `↓` | Navigate menu items and table rows             |
| `Enter`   | Select / confirm                               |
| `c`       | Open contexts view (main menu)                 |
| `s`       | Set selected as active context (contexts view) |
| `x`       | Clear active context (contexts view)           |
| `a`       | Add a new secret (secrets view)                |
| `d`       | Delete selected item                           |
| `r`       | Reveal secret value (detail view)              |
| `Esc`     | Go back / cancel                               |
| `q`       | Quit the TUI                                   |

### Diagnose your setup

Run health checks to verify your envsec installation.

- `--json` — Output in JSON format for scripting

```bash
# Run all health checks
envsec doctor

# JSON output for scripting
envsec --json doctor
```

The `doctor` command verifies your envsec installation is working correctly. It checks:

- envsec and Effect runtime versions
- Platform support and Node.js version
- Credential store availability (macOS Keychain, Linux secret-tool, Windows cmdkey)
- Keychain read/write access
- Database path, permissions, and schema integrity
- Orphaned secrets (metadata without keychain entry)
- Expired secrets
- Environment variables (`ENVSEC_DB`, `ENVSEC_CONTEXT`)
- Current shell

### Shell completions

envsec supports dynamic tab completion for bash, zsh, and fish. Completions are context-aware: they suggest your actual context names, secret keys, and saved command names in real time by querying the metadata database.

```bash
# Bash (add to ~/.bashrc)
eval "$(envsec --completions bash)"

# Zsh: save the script in a directory on your fpath
mkdir -p ~/.zfunc
envsec --completions zsh > ~/.zfunc/_envsec
# then add this to ~/.zshrc, before compinit runs:
#   fpath=(~/.zfunc $fpath)
#   autoload -Uz compinit && compinit

# Fish (add to ~/.config/fish/config.fish)
envsec --completions fish | source
```

Homebrew installs the completion scripts for all three shells automatically.

What gets completed dynamically:

- `--context` / `-c` — lists all your contexts
- Secret key arguments (`get`, `add`, `delete`, `rename`, `secret`) and the key/pattern argument of `move` and `copy` — lists keys for the current context
- `move` / `copy` `--to` — lists contexts
- `cmd run` / `cmd delete` — lists saved command names
- Subcommands, flags, and static choices (shells, etc.) are also completed

## Comparison

How does envsec compare to other tools for managing environment secrets?

| Feature | envsec | dotenv / dotenvx | 1Password CLI (`op`) |
| --- | --- | --- | --- |
| Secret storage | OS credential store (Keychain, Secret Service, Credential Manager) | `.env` files on disk (dotenvx adds encryption) | 1Password cloud vault |
| Encryption at rest | Delegated to OS (Keychain, GNOME Keyring, DPAPI) | None (dotenv) / ECIES per-file (dotenvx) | AES-256 in 1Password cloud |
| Secrets on disk | Not by default — values go to the OS credential store; `env-file` writes a plaintext `.env` only when you ask | Always — `.env` files are plaintext by default | Never locally (fetched at runtime from cloud) |
| Offline access | Full — secrets are local in OS store | Full — files are local | Requires network (cached items available offline in app) |
| Account / subscription | None — free, open source, no signup | Free (dotenv) / free open source (dotenvx) | Paid subscription |
| Cross-platform | macOS, Linux, Windows | Any platform with Node.js / any runtime (dotenvx) | macOS, Linux, Windows |
| Context / environment organization | Contexts (e.g. `myapp.dev`, `stripe.prod`) | Separate `.env` files per environment | Vaults and items |
| Run commands with secrets | `envsec run` — placeholder interpolation + `--inject` env vars | `dotenvx run -- cmd` — injects from encrypted `.env` | `op run -- cmd` — injects via secret references |
| Export to `.env` file | `envsec env-file` (tracked for audit) | Native format — `.env` files are the source of truth | `op inject --out-file` |
| Import from `.env` file | `envsec load` (with conflict detection) | N/A — `.env` is the primary store | Manual item creation |
| Shell env export | `eval "$(envsec env)"` — bash, zsh, fish, powershell | `dotenvx run` or `node -r dotenv/config` | `op run --env-file` |
| Interactive shell session | `envsec shell` — scoped subshell with auto-cleanup | Not built-in | Not built-in |
| Secret search | Glob patterns on keys and contexts | Not built-in | `op item list --tags/--category` filtering |
| Expiry audit | `envsec audit` — expired, expiring, tracked `.env` files | Not built-in | Watchtower (in app, not CLI) |
| Saved commands | `envsec cmd` — save, list, search, run, delete | Not built-in | Not built-in |
| Move / copy secrets | `envsec move` and `envsec copy` between contexts | Manual file copy | `op item move` between vaults |
| Rename secrets | `envsec rename` (preserves value and metadata) | Manual edit of `.env` file | `op item edit` |
| GPG-encrypted sharing | `envsec share --encrypt-to` (export only; import with `load`) | Encrypted `.env` files committed to git (dotenvx) | Built-in vault sharing, team provisioning |
| Interactive TUI | `envsec tui` — full-screen terminal UI | Not built-in | Not built-in |
| Health diagnostics | `envsec doctor` — checks platform, keychain, DB integrity | Not built-in | Not built-in |
| Shell completions | Dynamic (contexts, keys, commands) for bash, zsh, fish | Not built-in | `op completion` for bash, zsh, fish, powershell |
| SDK / programmatic access | `@envsec/sdk` for Node.js / Bun | `require('dotenv').config()` — core use case | 1Password SDKs (Node.js, Python, Go, etc.) |
| Team / multi-user | GPG sharing (manual) | Git-based sharing with encrypted `.env` (dotenvx) | Built-in team management, RBAC, audit logs |
| Metadata tracking | SQLite (key names, timestamps — never values) | None | Cloud-based item history and audit logs |

<!-- | CI/CD integration | Standard CLI — works anywhere Node.js runs | `dotenvx run` in any CI pipeline | Service accounts, native CI/CD integrations | -->

In short: dotenv is the simplest approach (files on disk), 1Password CLI is the most feature-rich for teams with cloud sync and RBAC, and envsec sits in between — offering OS-native encryption with zero accounts, zero cloud dependencies, and a developer-focused workflow that goes beyond what `.env` files can do.

## How it works

Secrets are stored in the native OS credential store. The backend is selected automatically based on the platform:

| OS | Backend | Tool / API |
| --- | --- | --- |
| macOS | Keychain | `security` CLI |
| Linux | Secret Service API (D-Bus) | `secret-tool` (libsecret) |
| Windows | Credential Manager | PowerShell P/Invoke (advapi32 `CredWriteW` / `CredReadW` / `CredDeleteW`) |

Metadata (key names, timestamps) is kept in a SQLite database at `~/.envsec/store.sqlite` (configurable via `--db` or `ENVSEC_DB`). Keys are one or more dot-separated segments (e.g. `token`, `api.key`, `db.prod.password`), up to 256 characters. Each segment starts with a letter or digit and may contain letters, digits, hyphens and underscores. The last segment becomes the credential store's account; the context and any earlier segments form the service.

## Security

envsec is built around a simple principle: your secrets belong in your OS, not in dotfiles. Every design decision starts from that foundation.

### How envsec protects your secrets

**OS-native encryption, zero custom crypto.** Secret values are stored directly in macOS Keychain, GNOME Keyring / KDE Wallet, or Windows Credential Manager. envsec never invents its own encryption — it delegates to the battle-tested credential stores your operating system already provides, protected by your user session and (on macOS) the login keychain.

**Full Unicode support.** Secret values can contain any Unicode characters, including emoji and accented letters. Values are base64-encoded before being stored in the OS credential store, avoiding platform-specific encoding quirks (e.g. macOS `security` CLI hex-encoding non-ASCII output). Legacy plaintext secrets are read transparently for backward compatibility.

**Secrets don't touch disk as plaintext.** Values go straight from your terminal into the OS credential store. envsec never writes them to config files, logs, or intermediate storage; the only exception is `env-file`, which writes a `.env` file because you asked for one.

**No secrets in terminal output.** The `list` and `search` commands display key names only — values are never printed. This keeps secrets out of scrollback buffers, screen recordings, and shoulder-surfing range.

**Safe command execution.** The `run` command passes secrets as environment variables of the child process: each `{key}` placeholder becomes a reference to such a variable, never the literal value. Secret values therefore stay out of the command string and your shell history. If any referenced secret is missing, the command is blocked entirely — no partial execution with incomplete credentials.

**Input validation and injection prevention.** Context names are validated against a strict allowlist (alphanumeric, dots, hyphens, underscores) with path traversal and prototype pollution checks. All SQLite queries use prepared statements with bind parameters, preventing SQL injection. PowerShell arguments on Windows are escaped to guard against command injection.

**Restrictive file permissions.** The metadata directory (`~/.envsec/`) is created with `0700` permissions and the SQLite database with `0600`, limiting access to the owning user.

### Known limitations and areas for improvement

We believe in being upfront about what envsec does not yet cover. These are real trade-offs, not bugs — and understanding them helps you make informed decisions.

**Metadata is visible.** The SQLite database at `~/.envsec/store.sqlite` stores key names, context names, and timestamps — never secret values, but enough to reveal _what_ secrets exist. Saved command templates (with `{key}` placeholders) are also stored there. If metadata confidentiality matters to you, ensure your home directory is on an encrypted volume.

**`env-file` exports are plaintext.** The `env-file` command writes secret values to a `.env` file on disk. This is inherently sensitive — treat the output file accordingly and never commit it to version control. Consider it a convenience bridge, not a storage mechanism.

**Shell execution carries inherent risk.** The `run` command passes your command template through `/bin/sh` (or `cmd.exe` on Windows). If the template itself comes from untrusted input, shell injection is possible. Only run command templates you wrote or trust.

**No cross-context access control.** Any process running as your OS user can read all secrets across all contexts. envsec relies on OS-level user isolation — it does not add its own authorization layer between contexts.

**Linux headless environments.** On Linux, envsec depends on an active D-Bus session and a keyring daemon (e.g. `gnome-keyring-daemon`). In containers or headless servers without a graphical session, the keyring may be unavailable or may store secrets with weaker protection.

**Values briefly appear in the process list on macOS and Windows.** Storing a secret runs `security` (macOS) or `powershell.exe` (Windows) with the base64-encoded value as a command-line argument, so it is visible in `ps` or Task Manager for as long as that write runs. On Linux the value goes to `secret-tool` on stdin instead. Separately, a `{key}` placeholder used as a program argument (e.g. `curl {api.url}`) is expanded by the shell into that program's arguments, which `ps` shows.

**Child processes inherit secrets.** Secrets injected by `run`, `cmd run` and `shell` are environment variables, so every process the child starts inherits them too.

**`env-file` uses the default file mode.** The file is created with your umask (usually `0644`), so other local users may be able to read it. Restrict it with `chmod 600` if that matters.

**Expiry is advisory.** `get`, `list` and `audit` warn about expired secrets, but envsec still returns and uses them. Rotate a secret yourself when it expires.

**`share` trusts any matching key.** GPG is called with `--trust-model always`, so `share` encrypts to whatever key in your keyring matches `--encrypt-to` without checking its trust level. Verify the recipient's fingerprint before sharing.

**Encryption depends on your OS.** envsec adds no additional at-rest encryption beyond what the native credential store provides. On systems without full-disk encryption, an attacker with physical access could potentially extract secrets from the keychain. We recommend enabling full-disk encryption (FileVault, LUKS, BitLocker) for the strongest protection.

## Development

### Prerequisites

- Node.js >= 22.13
- pnpm

The core, SDK, CLI, and TUI packages use Effect 4 and are pinned to `4.0.0`. Keep the Effect and `@effect/platform-node-shared` versions aligned across the workspace (the CLI imports its modules directly instead of `@effect/platform-node`, which would also pull in redis and undici). The matching Effect source is vendored in `repos/effect` (via `git subtree`) as read-only reference material for contributors and coding agents; never import from it.

### Setup

```bash
git clone https://github.com/davidnussio/envsec.git
cd envsec
pnpm install
pnpm run build
```

### Project Structure

```
packages/
  cli/     → envsec CLI (published as `envsec`)
  sdk/     → Node.js/Bun SDK (published as `@envsec/sdk`)
  core/    → Core engine, shared by CLI and SDK (published as `@envsec/core`)
  tui/     → Interactive terminal UI (published as `@envsec/tui`)
apps/
  website/ → Documentation website
```

### Common commands

```bash
# Build all packages
pnpm run build

# Lint and format check (all packages)
pnpm run check

# Auto-fix lint and formatting
pnpm run fix

# Run package unit and contract tests
pnpm run test:unit

# Run the CLI end-to-end suite with isolated database and credential fixtures
pnpm --filter envsec test
```

Releases are published by CI, not from a local machine: publishing a GitHub release for a `vX.Y.Z` tag (or `vX.Y.Z-beta.N` for the beta channel) runs `.github/workflows/release.yml`. It builds and smoke-tests the standalone binaries, sets every package version from the tag, publishes `@envsec/core`, `@envsec/sdk`, `@envsec/tui` and `envsec` to npm (dist-tag `latest`, `beta`, `alpha` or `next`, depending on the tag), attaches the binaries and `SHA256SUMS` to the release and updates the Homebrew formula.

The isolated E2E suite never accesses the native credential store. To exercise the real OS adapter on macOS or Linux, build first and opt in explicitly:

```bash
ENVSEC_E2E_CLI="$PWD/packages/cli/dist/main.js" \
  ENVSEC_E2E_ISOLATED=0 \
  pnpm --filter envsec test
```

Native E2E tests use dedicated `test.e2e*` contexts and remove them afterward.

### Standalone binary

The CLI can also be compiled with [Bun](https://bun.sh) into a single executable that embeds its runtime, so it runs without Node.js or `node_modules`:

```bash
pnpm run build                           # builds @envsec/core and @envsec/tui first
pnpm --filter envsec run build:bin       # current platform → packages/cli/release/envsec
pnpm --filter envsec run build:bin --all # darwin, linux (glibc + musl), windows
```

### Running locally without installing

Create a temporary alias to use the local build as if it were installed globally:

```bash
# Bash / Zsh
alias envsec="node $(pwd)/packages/cli/dist/main.js"

# Fish
alias envsec "node (pwd)/packages/cli/dist/main.js"
```

### Testing shell completions locally

After building and setting up the alias, load the completions in your current session:

```bash
# Bash
alias envsec="node $(pwd)/packages/cli/dist/main.js"
eval "$(envsec --completions bash)"

# Zsh (completion functions are loaded from fpath)
alias envsec="node $(pwd)/packages/cli/dist/main.js"
mkdir -p ~/.zfunc && envsec --completions zsh > ~/.zfunc/_envsec
fpath=(~/.zfunc $fpath) && autoload -Uz compinit && compinit

# Fish
alias envsec "node (pwd)/packages/cli/dist/main.js"
envsec --completions fish | source
```

Then press TAB after `envsec -c ` to see your contexts, or after `envsec -c myapp.dev get ` to see secret keys.

### Running tests

End-to-end integration tests cover the full CLI lifecycle (add, get, list, search, env-file, load, delete, run, cmd, audit, share, completions).

```bash
# Build first
pnpm run build

# macOS / Linux
bash packages/cli/test/e2e-test.sh

# Windows (PowerShell)
pwsh packages/cli/test/e2e-test.ps1
```

CI runs on GitHub Actions for every push and pull request to `main` and `beta`: `ci.yml` runs `pnpm run check`, typechecks, unit tests and a standalone binary build; `e2e.yml` runs (when `packages/**` or the workspace manifests change) `e2e-test.sh` on macOS and Ubuntu and `e2e-test.ps1` on Windows.

## License

MIT
