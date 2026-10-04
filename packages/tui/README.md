# @envsec/tui

Interactive terminal UI for [envsec](https://github.com/davidnussio/envsec): browse contexts, view, add, delete and search secrets, manage saved commands, audit expiring secrets, and import/export `.env` files — without memorizing commands.

## Usage

The TUI ships with the `envsec` CLI:

```bash
envsec tui
envsec -c myapp.dev tui   # start in a context
```

Navigate with the arrow keys, `Enter` to select, `Esc` to go back and `q` to quit. Secret values stay masked until you press `r`.

> This package is the TUI engine used by the CLI. Most users should install [`envsec`](https://www.npmjs.com/package/envsec) instead of depending on it directly.

## License

MIT
