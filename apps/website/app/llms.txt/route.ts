const content = `# envsec

> envsec is a cross-platform CLI tool and Node.js SDK for managing environment secrets using native OS credential stores (macOS Keychain, Linux Secret Service/GNOME Keyring, Windows Credential Manager). Secrets are never stored as plaintext on disk.

envsec stores secret values directly in the OS native credential store and tracks metadata (key names, timestamps) in a local SQLite database. It is published on npm as \`envsec\` (CLI) and \`@envsec/sdk\` (SDK). Requires Node.js >= 22.

Key capabilities:
- Store, retrieve, delete, rename, move, and copy secrets organized by context (e.g. \`myapp.dev\`, \`stripe-api.prod\`)
- Generate cryptographically secure random secrets with configurable length, charset, and prefix
- Search contexts and secrets with glob patterns
- Export secrets to \`.env\` files or as shell environment variables (bash, zsh, fish, powershell)
- Run commands with secret interpolation via environment variables
- Save and rerun named commands (\`cmd\` subcommand)
- Audit secrets for expiry and rotation status
- Load secrets from \`.env\` files with conflict detection
- Share secrets encrypted with GPG for team members
- Interactive terminal UI (\`envsec tui\`)
- Programmatic SDK for Node.js and Bun (\`@envsec/sdk\`)
- Shell completions (bash, zsh, fish) with dynamic context and key suggestions
- Spawn secrets-scoped shell sessions (\`envsec shell\`)
- Health diagnostics (\`envsec doctor\`)

## Installation

Install via Homebrew, npm, npx, or mise:

\`\`\`bash
# Homebrew (macOS / Linux)
brew tap davidnussio/homebrew-tap
brew install envsec

# npm (global)
npm install -g envsec

# npx (no install)
npx envsec

# mise
mise use -g npm:envsec
\`\`\`

### Platform requirements

- macOS: no extra dependencies (uses built-in Keychain via \`security\` CLI)
- Linux: requires \`libsecret-tools\` (\`secret-tool\`) and an active D-Bus session with a keyring daemon
- Windows: no extra dependencies (uses Credential Manager via \`cmdkey\` + PowerShell)

## Core Concepts

### Contexts

Secrets are organized by context — a free-form label like \`myapp.dev\`, \`stripe-api.prod\`, or \`work.staging\`. Most commands require \`--context\` (or \`-c\`).

### Secret Keys

Keys must contain at least one dot separator (e.g. \`api.key\`, \`db.connection_string\`). The dot maps to the credential store's service/account structure. When exported to environment variables, keys are converted to \`UPPER_SNAKE_CASE\` (e.g. \`api.token\` → \`API_TOKEN\`).

### Metadata Database

Metadata (key names, timestamps, expiry info) is stored in SQLite at \`~/.envsec/store.sqlite\`. Secret values are never stored in the database. Override the path with \`--db\` flag or \`ENVSEC_DB\` environment variable.

## CLI Commands

### Add a secret

\`\`\`bash
envsec -c myapp.dev add api.key --value "sk-abc123"
envsec -c myapp.dev add api.key                        # interactive masked prompt
envsec -c myapp.dev add api.key -v "sk-abc123" --expires 30d
\`\`\`

Supported duration units: \`m\` (minutes), \`h\` (hours), \`d\` (days), \`w\` (weeks), \`mo\` (months), \`y\` (years). Combinable: \`1y6mo\`, \`2w3d\`, \`1d12h\`.

### Generate a secret

\`\`\`bash
envsec -c myapp.dev secret api.key                              # 32-char alphanumeric (default)
envsec -c myapp.dev secret api.key --length 64                  # custom length
envsec -c myapp.dev secret api.key --prefix "sk_" --length 48   # with prefix
envsec -c myapp.dev secret db.password --special --length 64    # alphanumeric + !@#$%^&*
envsec -c myapp.dev secret master.key --all-chars --length 128  # all printable ASCII
envsec -c myapp.dev secret api.key --prefix "sk_" -l 48 --expires 90d  # with expiry
envsec secret --length 32                                       # standalone password generator
envsec secret --special --length 64 --prefix "pk_"              # standalone with options
\`\`\`

Character set options: \`--alphanumeric\` / \`-a\` (default, \`[a-zA-Z0-9]\`), \`--special\` / \`-s\` (adds \`!@#$%^&*\`), \`--all-chars\` / \`-A\` (all printable ASCII). The \`--prefix\` / \`-p\` flag prepends a fixed string (e.g. \`sk_\`, \`whsec_\`). Total stored length = prefix + \`--length\`. Uses \`crypto.randomBytes\` with rejection sampling to avoid modulo bias. When both \`--context\` and a key name are provided, the value is stored and printed. Without either, the raw value is printed to stdout — works as a standalone password generator.

### Get a secret

\`\`\`bash
envsec -c myapp.dev get api.key
envsec -c myapp.dev get api.key --quiet   # raw value only
\`\`\`

### Delete a secret

\`\`\`bash
envsec -c myapp.dev delete api.key
envsec -c myapp.dev del api.key           # alias
\`\`\`

### Rename a secret

\`\`\`bash
envsec -c myapp.dev rename old.key new.key
envsec -c myapp.dev rename old.key existing.key --force
\`\`\`

### List secrets or contexts

\`\`\`bash
envsec -c myapp.dev list       # list secrets in context
envsec list                    # list all contexts with counts
\`\`\`

### Search

\`\`\`bash
envsec -c myapp.dev search "api.*"   # search secrets
envsec search "myapp.*"              # search contexts
\`\`\`

### Move secrets between contexts

\`\`\`bash
envsec -c myapp.dev move api.token --to myapp.prod
envsec -c myapp.dev move "redis.*" --to myapp.prod -y
envsec -c myapp.dev move --all --to myapp.prod -y
envsec -c myapp.dev move "redis.*" --to myapp.prod --force -y
\`\`\`

### Copy secrets between contexts

\`\`\`bash
envsec -c myapp.dev copy api.token --to myapp.staging
envsec -c myapp.dev copy --all --to myapp.staging -y
envsec -c myapp.dev copy "redis.*" --to myapp.staging --force -y
\`\`\`

### Run a command with secrets

\`\`\`bash
envsec -c myapp.dev run 'curl {api.url} -H "Authorization: Bearer {api.token}"'
envsec -c myapp.dev run --inject 'node server.js'       # inject ALL context secrets as env vars
envsec -c myapp.dev run -i 'docker compose up'           # short form
envsec -c myapp.dev run --inject 'curl {api.url} -H "Authorization: Bearer $API_TOKEN"'  # combine with placeholders
envsec -c myapp.dev run --save --name deploy 'kubectl apply -f - <<< {k8s.manifest}'
\`\`\`

Placeholders \`{key}\` are resolved to secret values. Secrets are injected as environment variables (not interpolated into the command string), so they don't appear in \`ps\` output or shell history. With \`--inject\` (\`-i\`), all context secrets are exported as UPPER_SNAKE_CASE env vars (e.g. \`db.password\` → \`DB_PASSWORD\`). Explicit \`{key}\` placeholders take precedence over injected variables.

### Saved commands

\`\`\`bash
envsec cmd list                              # list all saved commands
envsec cmd run deploy                        # run a saved command
envsec cmd run deploy -o myapp.prod          # override context
envsec cmd run deploy --quiet                # suppress info output
envsec cmd run deploy --inject               # inject all context secrets as env vars
envsec cmd run deploy -i                     # short form
envsec cmd search psql                       # search commands
envsec cmd search deploy -n                  # search by name only
envsec cmd delete deploy                     # delete a saved command
\`\`\`

### Generate .env file

\`\`\`bash
envsec -c myapp.dev env-file
envsec -c myapp.dev env-file --output .env.local
\`\`\`

### Export as environment variables

\`\`\`bash
eval $(envsec -c myapp.dev env)              # bash/zsh
envsec -c myapp.dev env --shell fish         # fish syntax
envsec -c myapp.dev env --shell powershell   # powershell syntax
eval $(envsec -c myapp.dev env --unset)      # unset variables
\`\`\`

### Secrets-scoped shell session

\`\`\`bash
envsec -c myapp.dev shell
envsec -c myapp.dev shell --shell zsh
envsec -c myapp.dev shell --no-inherit       # clean env (only secrets + PATH)
envsec -c myapp.dev shell --quiet            # suppress banner
\`\`\`

### Load from .env file

\`\`\`bash
envsec -c myapp.dev load
envsec -c myapp.dev load --input .env.local
envsec -c myapp.dev load --force             # overwrite existing
\`\`\`

Keys are converted from \`UPPER_SNAKE_CASE\` to \`dotted.lowercase\` (e.g. \`API_TOKEN\` → \`api.token\`).

### Share secrets (GPG encrypted)

\`\`\`bash
envsec -c myapp.dev share --encrypt-to alice@example.com
envsec -c myapp.dev share --encrypt-to alice@example.com -o secrets.enc
envsec -c myapp.dev --json share --encrypt-to alice@example.com -o secrets.enc
\`\`\`

### Audit

\`\`\`bash
envsec -c myapp.dev audit                    # default 30-day window
envsec -c myapp.dev audit --within 7d
envsec audit                                 # all contexts
envsec -c myapp.dev audit --json
\`\`\`

### Doctor (diagnostics)

\`\`\`bash
envsec doctor
envsec --json doctor
\`\`\`

Checks platform support, credential store availability, keychain access, database integrity, orphaned secrets, expired secrets, environment variables, and current shell.

### Shell completions

\`\`\`bash
eval "$(envsec --completions bash)"          # bash
eval "$(envsec --completions zsh)"           # zsh
envsec --completions fish | source           # fish
\`\`\`

## SDK (@envsec/sdk)

Node.js / Bun SDK for loading secrets programmatically without \`.env\` files.

\`\`\`bash
npm install @envsec/sdk
\`\`\`

### Functional API

\`\`\`typescript
import { loadSecrets } from "@envsec/sdk";

// Load all secrets from a context
const secrets = await loadSecrets({ context: "myapp.dev" });

// Load and inject into process.env
await loadSecrets({ context: "myapp.prod", inject: true });
// process.env.API_KEY is now set
\`\`\`

\`\`\`typescript
import { withSecrets } from "@envsec/sdk";

// Run callback with secrets, process.env auto-restored after
const result = await withSecrets(
  { context: "myapp.dev", inject: true },
  async (secrets) => {
    return fetch(secrets["api.url"]);
  }
);
\`\`\`

### Class API (EnvsecClient)

\`\`\`typescript
import { EnvsecClient } from "@envsec/sdk";

const client = await EnvsecClient.create({ context: "myapp.dev" });

const apiKey = await client.get("api.key");       // string | null
const dbUrl = await client.require("db.url");      // string (throws if missing)

await client.set("api.key", "sk-new-value");
await client.set("api.key", "sk-new-value", { expires: "30d" });
await client.delete("api.key");

const all = await client.loadAll();                // Record<string, string>
await client.injectEnv();                          // inject all into process.env

await client.close();
\`\`\`

### Multi-context support

\`\`\`typescript
const client = await EnvsecClient.create({
  context: ["myapp.defaults", "myapp.dev"],
});
// "myapp.dev" values override "myapp.defaults" (left-to-right merge)
const secrets = await client.loadAll();
await client.close();
\`\`\`

### SDK Options

- \`context\`: \`string | string[]\` — context(s) to operate on
- \`dbPath\`: \`string\` (optional) — override SQLite path
- \`inject\`: \`boolean\` (default \`false\`) — inject secrets into \`process.env\`

## Security Model

- Secret values are stored in the OS native credential store (macOS Keychain, GNOME Keyring, Windows Credential Manager) — never in config files, logs, or intermediate storage
- Full Unicode support via base64 encoding before storage
- The \`run\` command injects secrets as child process environment variables, not into the command string
- Context names are validated against a strict allowlist with path traversal and prototype pollution checks
- All SQLite queries use prepared statements (no SQL injection)
- PowerShell arguments on Windows are escaped against command injection
- Metadata directory (\`~/.envsec/\`) is created with \`0700\` permissions, database with \`0600\`

### Known limitations

- SQLite metadata stores key names and timestamps (not values) — enough to reveal what secrets exist
- \`env-file\` exports are plaintext on disk
- \`run\` passes commands through \`/bin/sh\` — only run trusted templates
- No cross-context access control beyond OS user isolation
- Linux headless environments may lack a keyring daemon
- At-rest encryption depends on the OS credential store and full-disk encryption

## Architecture

The project is a monorepo with four packages:

- \`envsec\` (CLI) — command-line interface, published as \`envsec\` on npm
- \`@envsec/sdk\` — Node.js/Bun SDK for programmatic access
- \`@envsec/core\` — core engine with OS credential store adapters and metadata DB
- \`@envsec/tui\` — interactive terminal UI

Built with TypeScript (strict mode), Effect for functional error handling and dependency injection, and sql.js for WASM-based SQLite.

| OS      | Backend                     | Tool / API                       |
|---------|-----------------------------|----------------------------------|
| macOS   | Keychain                    | \`security\` CLI                   |
| Linux   | Secret Service API (D-Bus)  | \`secret-tool\` (libsecret)        |
| Windows | Credential Manager          | \`cmdkey\` + PowerShell (advapi32) |

## Optional

- [GitHub Repository](https://github.com/davidnussio/envsec): Source code, issues, and contributions
- [npm: envsec](https://www.npmjs.com/package/envsec): CLI package on npm
- [npm: @envsec/sdk](https://www.npmjs.com/package/@envsec/sdk): SDK package on npm
- [npm: @envsec/core](https://www.npmjs.com/package/@envsec/core): Core engine package on npm
- [npm: @envsec/tui](https://www.npmjs.com/package/@envsec/tui): TUI package on npm
`;

export function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
