# @envsec/core

Core secrets management engine for [envsec](https://github.com/davidnussio/envsec) — native OS credential store adapters and SQLite metadata database.

## Overview

This package provides the foundational services used by the `envsec` CLI and `@envsec/sdk`:

- **KeychainAccess** — platform-specific credential store adapters (macOS Keychain, Linux Secret Service, Windows Credential Manager)
- **MetadataStore** — SQLite-based metadata tracking (key names, timestamps, expiry)
- **SecretStore** — high-level facade combining keychain operations with metadata
- **Domain types** — validated schemas for context names, secret keys, and durations

## Installation

```bash
npm install @envsec/core
# or
pnpm add @envsec/core
```

> Most users should use `envsec` (CLI) or `@envsec/sdk` (programmatic API) instead of this package directly.

## Architecture

Built with [Effect](https://effect.website) using the layered service pattern:

1. **Services** define interfaces as `Context.Tag`
2. **Implementations** provide concrete `Layer` instances
3. **SecretStore** composes `KeychainAccess` + `MetadataStore` into a single facade

## Supported Platforms

| OS      | Backend                    | Tool / API                        |
|---------|----------------------------|-----------------------------------|
| macOS   | Keychain                   | `security` CLI                    |
| Linux   | Secret Service API (D-Bus) | `secret-tool` (libsecret)         |
| Windows | Credential Manager         | `cmdkey` + PowerShell (advapi32)  |

## License

MIT
