---
"envsec": minor
---

`cmd run` now takes the target context from the global `--context` / `-c` flag; the dedicated `--override-context` / `-o` option is removed. A saved command still runs in the context it was saved with by default. `-c` used to be silently ignored by `cmd run` and now overrides that context, with a warning that shows both (silenced by `--quiet`). `ENVSEC_CONTEXT` is ignored by `cmd run`, so a command saved for one context never silently runs against another (for example inside `envsec shell`).

Migration: `envsec cmd run deploy -o myapp.prod` → `envsec -c myapp.prod cmd run deploy`.
