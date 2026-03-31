# @envsec/sdk

Node.js / Bun SDK for [envsec](https://github.com/davidnussio/envsec) — load secrets from the OS credential store without `.env` files.

## Installation

```bash
npm install @envsec/sdk
# or
pnpm add @envsec/sdk
```

Requires Node.js >= 22 and a working envsec setup (OS credential store accessible).

## Quick Start

```typescript
import { loadSecrets } from "@envsec/sdk";

// Load all secrets from a context
const secrets = await loadSecrets({ context: "myapp.dev" });
console.log(secrets["api.key"]);

// Load and inject into process.env in one shot
await loadSecrets({ context: "myapp.prod", inject: true });
// process.env.API_KEY is now set
```

## APIs

The SDK exposes two styles of API:

### Functional API — `loadSecrets` / `withSecrets`

One-shot functions for the most common use cases. No lifecycle management needed.

#### `loadSecrets(options): Promise<Record<string, string>>`

Load all secrets from one or more contexts. Optionally inject them into `process.env`.

```typescript
import { loadSecrets } from "@envsec/sdk";

const secrets = await loadSecrets({
  context: "myapp.dev",
  inject: true, // keys are transformed: "api.token" → API_TOKEN
});
```

#### `withSecrets(options, fn): Promise<T>`

Run a callback with secrets available. When `inject: true`, `process.env` is automatically restored after the callback completes.

```typescript
import { withSecrets } from "@envsec/sdk";

const result = await withSecrets(
  { context: "myapp.dev", inject: true },
  async (secrets) => {
    // process.env.API_TOKEN is set here
    return fetch(secrets["api.url"]);
  }
);
// process.env is restored to its original state
```

### Class API — `EnvsecClient`

Full lifecycle client for multi-operation workflows. Supports get, set, delete, and bulk loading.

```typescript
import { EnvsecClient } from "@envsec/sdk";

const client = await EnvsecClient.create({ context: "myapp.dev" });

// Read
const apiKey = await client.get("api.key");       // string | null
const dbUrl = await client.require("db.url");      // string (throws if missing)

// Write
await client.set("api.key", "sk-new-value");
await client.set("api.key", "sk-new-value", { expires: "30d" });

// Delete
await client.delete("api.key");

// Bulk
const all = await client.loadAll();                // Record<string, string>
await client.injectEnv();                          // inject all into process.env

// Always close when done
await client.close();
```

## Multi-Context Support

Pass an array of contexts to merge secrets from multiple sources. Later contexts override earlier ones (left-to-right merge).

```typescript
const client = await EnvsecClient.create({
  context: ["myapp.defaults", "myapp.dev"],
});

// "myapp.dev" values win over "myapp.defaults"
const secrets = await client.loadAll();
await client.close();
```

Write operations (`set`, `delete`) target the last (primary) context.

## Options

### `EnvsecClientOptions`

| Option    | Type                 | Description                                              |
|-----------|----------------------|----------------------------------------------------------|
| `context` | `string \| string[]` | Context(s) to operate on. Array enables multi-context merge. |
| `dbPath`  | `string` (optional)  | Override default SQLite path (`~/.envsec/store.sqlite`). |

### `LoadSecretsOptions`

Extends `EnvsecClientOptions` with:

| Option   | Type      | Default | Description                                         |
|----------|-----------|---------|-----------------------------------------------------|
| `inject` | `boolean` | `false` | Inject secrets into `process.env` after loading.    |

### `WithSecretsOptions`

Same as `LoadSecretsOptions`.

## Key Transformation

When injecting into `process.env`, keys are converted to `UPPER_SNAKE_CASE`:

| Secret Key        | Environment Variable |
|-------------------|----------------------|
| `api.token`       | `API_TOKEN`          |
| `db.connection`   | `DB_CONNECTION`      |
| `redis.cache-url` | `REDIS_CACHE_URL`    |

## License

MIT
