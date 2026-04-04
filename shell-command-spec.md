# `envsec shell` — Implementation Spec

## Overview

`envsec -c <context> shell` spawns a subshell with all secrets from the given context injected as environment variables. When the user exits the subshell, the secrets vanish with it — no cleanup required.

## CLI Interface

```bash
envsec -c myapp.dev shell [options]
```

### Options

| Flag | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--shell` | `-s` | `string` | auto-detect | Shell to spawn (`bash`, `zsh`, `fish`, `powershell`) |
| `--no-inherit` | | `boolean` | `false` | Do not inherit parent environment variables |
| `--quiet` | `-q` | `boolean` | `false` | Suppress startup/exit banner |

### Examples

```bash
# Interactive session with all secrets from myapp.dev
envsec -c myapp.dev shell

# Force a specific shell
envsec -c myapp.dev shell --shell zsh

# Maximum isolation — only envsec secrets in env
envsec -c myapp.dev shell --no-inherit

# No banner output (useful in scripts)
envsec -c myapp.dev shell --quiet
```

---

## Behavior

### Startup sequence

1. Resolve context secrets via the existing store adapter (same path as `env` command)
2. Convert keys to `UPPER_SNAKE_CASE` (same logic as `env` and `env-file`)
3. Build child environment:
   - Default: `{ ...process.env, ...secrets, ENVSEC_CONTEXT: context }`
   - With `--no-inherit`: `{ ...secrets, ENVSEC_CONTEXT: context, PATH: process.env.PATH }`  
     (`PATH` is always preserved — without it the shell is unusable)
4. Set prompt indicator (see Shell-specific behavior below)
5. Spawn shell with `stdio: 'inherit'`
6. Wait for exit
7. Print exit message (unless `--quiet`)
8. Exit with the same exit code as the subshell

### Exit

- `envsec shell` exits with the same code as the subshell process
- Secrets are never written to disk — they exist only in the child process memory
- No explicit cleanup needed: process exit is the cleanup

### `ENVSEC_CONTEXT` variable

Always injected. Lets users and scripts know they are inside an envsec session:

```bash
echo $ENVSEC_CONTEXT   # myapp.dev
```

Also useful for prompt customization and shell integrations.

---

## Shell Detection

Auto-detection order:

1. `--shell` flag (explicit override)
2. `$SHELL` environment variable (Unix)
3. `$PSVersionTable` presence (PowerShell detection on Windows)
4. Fallback: `/bin/sh`

```ts
function detectShell(override?: string): { bin: string; args: string[] } {
  if (override) return resolveShell(override);
  if (process.env.SHELL) return resolveShell(path.basename(process.env.SHELL));
  if (process.platform === 'win32') return { bin: 'powershell.exe', args: ['-NoExit'] };
  return { bin: '/bin/sh', args: [] };
}

function resolveShell(name: string): { bin: string; args: string[] } {
  switch (name) {
    case 'bash': return { bin: 'bash', args: ['--norc', '--noprofile'] }; // see note below
    case 'zsh':  return { bin: 'zsh',  args: ['--no-rcs'] };
    case 'fish': return { bin: 'fish', args: [] };
    case 'powershell':
    case 'pwsh': return { bin: 'pwsh', args: ['-NoExit', '-NoProfile'] };
    default:     return { bin: name,   args: [] };
  }
}
```

> **Note on startup files**: Using `--norc`/`--no-rcs` avoids startup files overwriting `PS1` or re-exporting variables. Consider making this configurable if users report issues with aliases or functions they rely on. Default: skip startup files.

---

## Shell-specific Prompt Behavior

### bash / zsh

Set `PS1` in the child environment:

```ts
const contextLabel = `(envsec:${context})`;
env.PS1 = `${contextLabel} ${process.env.PS1 || '\\u@\\h:\\w\\$ '}`;
```

### fish

Fish ignores `PS1`. Instead, set only `ENVSEC_CONTEXT` and document that users can reference it in their `fish_prompt` function. Optionally print a reminder at startup:

```
🔐 envsec shell — context: myapp.dev
Type 'exit' to leave the session.
```

### PowerShell

Inject `$env:ENVSEC_CONTEXT`. Prompt modification requires a function override — skip for now, rely on banner only.

---

## Startup / Exit Banner

Unless `--quiet`:

**Startup:**
```
🔐 envsec shell — context: myapp.dev (12 secrets loaded)
Type 'exit' to leave the session.
```

**Exit:**
```
👋 Exiting envsec shell — secrets cleared.
```

Banner goes to `stderr` so it does not pollute stdout pipelines.

---

## Implementation Location

### File structure

```
src/
  commands/
    shell.ts        ← new file
  cmd-shell.ts      ← wires up the yargs command (follow existing pattern)
```

### Core logic sketch (`shell.ts`)

```ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getAll } from '../store.js';          // existing store method
import { toUpperSnakeCase } from '../utils.js'; // existing util

export async function runShellCommand(options: {
  context: string;
  shell?: string;
  noInherit?: boolean;
  quiet?: boolean;
  db: string;
}): Promise<void> {
  const { context, shell: shellOverride, noInherit = false, quiet = false, db } = options;

  // 1. Fetch secrets
  const secrets = await getAll({ context, db });
  const secretEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(secrets)) {
    secretEnv[toUpperSnakeCase(key)] = value;
  }

  // 2. Build env
  const parentEnv = noInherit
    ? { PATH: process.env.PATH ?? '' }
    : { ...process.env };

  const childEnv: Record<string, string> = {
    ...parentEnv,
    ...secretEnv,
    ENVSEC_CONTEXT: context,
  };

  // 3. Prompt indicator (bash/zsh only)
  const { bin, args } = detectShell(shellOverride);
  const shellName = path.basename(bin);
  if (['bash', 'zsh'].includes(shellName)) {
    childEnv.PS1 = `(envsec:${context}) ${process.env.PS1 ?? '\\u@\\h:\\w\\$ '}`;
  }

  // 4. Banner
  if (!quiet) {
    const count = Object.keys(secrets).length;
    process.stderr.write(
      `🔐 envsec shell — context: ${context} (${count} secret${count !== 1 ? 's' : ''} loaded)\n` +
      `Type 'exit' to leave the session.\n`
    );
  }

  // 5. Spawn
  const child = spawn(bin, args, { env: childEnv, stdio: 'inherit' });

  await new Promise<void>((resolve) => {
    child.on('close', (code) => {
      if (!quiet) {
        process.stderr.write('👋 Exiting envsec shell — secrets cleared.\n');
      }
      process.exit(code ?? 0);
      resolve();
    });
  });
}
```

---

## Error Cases

| Condition | Behavior |
|---|---|
| Context has no secrets | Warn and proceed (empty env injected) |
| Context does not exist | Hard fail with clear message: `Context "x" not found.` |
| Requested shell binary not found | Hard fail: `Shell "fish" not found in PATH.` |
| Already inside an envsec shell (`ENVSEC_CONTEXT` set) | Warn: `⚠ Already inside an envsec shell (context: myapp.dev). Nesting is allowed but may cause confusion.` |

---

## Tests (e2e)

Extend `test/e2e-test.sh` with:

```bash
# shell command: exits with correct code
echo "exit 42" | envsec -c $TEST_CONTEXT shell --quiet
assert_exit_code 42

# shell command: secret is visible inside subshell
result=$(echo "echo \$TEST_KEY_UPPER" | envsec -c $TEST_CONTEXT shell --quiet)
assert_equals "$result" "expected_value"

# shell command: ENVSEC_CONTEXT is set
result=$(echo "echo \$ENVSEC_CONTEXT" | envsec -c $TEST_CONTEXT shell --quiet)
assert_equals "$result" "$TEST_CONTEXT"

# shell command: --no-inherit hides parent vars
result=$(echo "echo \${HOME:-UNSET}" | envsec -c $TEST_CONTEXT shell --quiet --no-inherit)
assert_equals "$result" "UNSET"
```

---

## README additions

### New section under "Usage"

````markdown
### Start a secrets-scoped shell session

Spawn an interactive subshell with all secrets from the context injected as
environment variables. When you `exit`, the secrets are gone — no cleanup needed.

```bash
envsec -c myapp.dev shell
```

```
🔐 envsec shell — context: myapp.dev (8 secrets loaded)
Type 'exit' to leave the session.

(envsec:myapp.dev) ~ $ echo $DATABASE_URL
postgres://user:pass@localhost/mydb

(envsec:myapp.dev) ~ $ exit
👋 Exiting envsec shell — secrets cleared.
```

Options:

```bash
# Force a specific shell
envsec -c myapp.dev shell --shell zsh

# Only envsec secrets in env (no parent variables, except PATH)
envsec -c myapp.dev shell --no-inherit

# Suppress the startup/exit banner
envsec -c myapp.dev shell --quiet
```

The variable `ENVSEC_CONTEXT` is always set inside the session, so you can
reference it in scripts or prompt customizations.
````

---

## Open decisions

- [ ] **Startup files**: default to `--norc`/`--no-rcs` or load them? Leaning toward skip, make configurable.
- [ ] **fish prompt**: auto-detect and patch `fish_prompt` via `--init-command`, or document manual setup?
- [ ] **Windows PowerShell**: `$Profile` loading — skip for now, revisit.
- [ ] **Nesting detection**: warn only, or hard-fail? Leaning toward warn.
- [ ] **`--exec` variant**: `envsec -c ctx shell --exec "node server.js"` as alias for `run`? Probably out of scope — `run` already handles it.
