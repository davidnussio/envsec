---
"@envsec/core": patch
"envsec": patch
---

Fix a crash when a command started by `run`, `cmd run` or `shell` is killed by a signal, e.g. stopping `envsec run "npm run dev"` with Ctrl-C. envsec used to print a schema validation dump (`exitCode: Expected number, actual null`). It now exits with 128 + the signal number, like a shell: 130 and no message for Ctrl-C, or 143 with a short message for SIGTERM. `shell` also used to exit with 0 in that case.
