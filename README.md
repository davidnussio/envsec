# envsec

Secure environment secrets management for macOS using the native Keychain.

## Features

- Store secrets in macOS Keychain (not plain text files)
- Organize secrets by environment (dev, staging, prod, etc.)
- Track secret types (string, number, boolean) and metadata via SQLite
- Search secrets with glob patterns

## Requirements

- macOS
- Node.js >= 18

## Installation

```bash
npm install -g envsec
```

```bash
npx envsec
```

## Usage

All commands require an environment specified with `--env` (or `-e`):

### Add a secret

```bash
# Store a string
secenv -e dev add api.key --word "sk-abc123"

# Store a number
secenv -e dev add server.port --digit 3000

# Store a boolean
secenv -e dev add feature.enabled --bool
```

### Get a secret

```bash
secenv -e dev get api.key
```

### List all secrets

```bash
secenv -e dev list
```

### Search secrets

```bash
secenv -e dev search "api.*"
```

### Delete a secret

```bash
secenv -e dev delete api.key

# or use the alias
secenv -e dev del api.key
```

## How it works

Secrets are stored in the macOS Keychain using the `security` command-line tool. Metadata (key names, types, timestamps) is kept in a SQLite database at `~/.secenv/store.sqlite`. Keys must contain at least one dot separator (e.g., `service.account`) which maps to the Keychain service/account structure.

## License

MIT
