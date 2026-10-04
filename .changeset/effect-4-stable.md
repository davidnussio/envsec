---
"@envsec/core": patch
"@envsec/sdk": patch
"@envsec/tui": patch
"envsec": patch
---

Upgrade to Effect 4.0.0 stable. The CLI now imports from `effect/cli` and uses the
renamed `Flag`/`Argument` constructors (`String`, `Boolean`, `Int`, `Literals`).
