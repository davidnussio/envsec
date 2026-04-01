/**
 * Low-level terminal helpers for the interactive TUI.
 * Raw ANSI escape sequences — zero dependencies.
 */

import { Effect } from "effect";

// ── ANSI escape sequences ───────────────────────────────────────────

export const ESC = "\x1b";
export const CSI = `${ESC}[`;

export const cursor = {
  hide: `${CSI}?25l`,
  show: `${CSI}?25h`,
  moveTo: (row: number, col: number) => `${CSI}${row};${col}H`,
  moveUp: (n = 1) => `${CSI}${n}A`,
  moveDown: (n = 1) => `${CSI}${n}B`,
  saveCursor: `${ESC}7`,
  restoreCursor: `${ESC}8`,
};

export const screen = {
  clear: `${CSI}2J`,
  clearLine: `${CSI}2K`,
  clearDown: `${CSI}J`,
  altBuffer: `${CSI}?1049h`,
  mainBuffer: `${CSI}?1049l`,
};

// ── Colors (reuse project conventions) ──────────────────────────────

const useColor = (() => {
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.FORCE_COLOR) {
    return true;
  }
  return process.stdout.isTTY ?? false;
})();

const ansi = (code: string) => (text: string) =>
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text;

export const c = {
  bold: ansi("1"),
  dim: ansi("2"),
  italic: ansi("3"),
  underline: ansi("4"),
  inverse: ansi("7"),
  green: ansi("32"),
  red: ansi("31"),
  yellow: ansi("33"),
  blue: ansi("34"),
  cyan: ansi("36"),
  magenta: ansi("35"),
  white: ansi("37"),
  gray: ansi("90"),
  bgBlue: ansi("44"),
  bgGreen: ansi("42"),
  bgYellow: ansi("43"),
  bgRed: ansi("41"),
  bgCyan: ansi("46"),
  bgWhite: ansi("47;30"),
};

// ── Terminal size ───────────────────────────────────────────────────

export const getSize = (): { rows: number; cols: number } => ({
  rows: process.stdout.rows ?? 24,
  cols: process.stdout.columns ?? 80,
});

// ── Write helpers ───────────────────────────────────────────────────

export const write = (s: string): void => {
  process.stdout.write(s);
};

export const writeLine = (row: number, text: string): void => {
  write(`${cursor.moveTo(row, 1)}${screen.clearLine}${text}`);
};

// ── Raw mode key reading ────────────────────────────────────────────

export interface KeyPress {
  ctrl: boolean;
  name: string;
  raw: string;
  shift: boolean;
}

const CTRL_KEYS: Record<string, { ctrl: boolean; name: string }> = {
  "\x03": { name: "c", ctrl: true },
  "\x04": { name: "d", ctrl: true },
  "\x1a": { name: "z", ctrl: true },
};

const SPECIAL_KEYS: Record<string, string> = {
  "\r": "return",
  "\n": "return",
  "\x1b": "escape",
  "\x7f": "backspace",
  "\b": "backspace",
  "\t": "tab",
  " ": "space",
  "\x1b[A": "up",
  "\x1b[B": "down",
  "\x1b[C": "right",
  "\x1b[D": "left",
  "\x1b[5~": "pageup",
  "\x1b[6~": "pagedown",
  "\x1b[H": "home",
  "\x1b[1~": "home",
  "\x1b[F": "end",
  "\x1b[4~": "end",
};

const parseKey = (data: Buffer): KeyPress => {
  const raw = data.toString("utf-8");
  const base: KeyPress = { ctrl: false, name: "", raw, shift: false };

  const ctrl = CTRL_KEYS[raw];
  if (ctrl) {
    return { ...base, ...ctrl };
  }

  const special = SPECIAL_KEYS[raw];
  if (special) {
    return { ...base, name: special };
  }

  if (raw.length === 1 && raw >= " ") {
    return { ...base, name: raw };
  }

  return { ...base, name: raw };
};

export const readKey: Effect.Effect<KeyPress> = Effect.async<KeyPress>(
  (resume) => {
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    const onData = (data: Buffer) => {
      process.stdin.removeListener("data", onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
      process.stdin.pause();
      resume(Effect.succeed(parseKey(data)));
    };

    process.stdin.on("data", onData);
  }
);

// ── Bracketed input reading (for text fields) ──────────────────────

export const readLine = (
  prompt: string,
  opts?: { mask?: boolean }
): Effect.Effect<string | null> =>
  Effect.async<string | null>((resume) => {
    write(prompt);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    let buf = "";

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
      process.stdin.pause();
    };

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: char-by-char input handling
    const handleChar = (ch: string): "cancel" | "continue" | "done" => {
      if (ch === "\r" || ch === "\n") {
        return "done";
      }
      if (ch === "\x03") {
        return "cancel";
      }
      if (ch === "\x7f" || ch === "\b") {
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          write("\b \b");
        }
        return "continue";
      }
      if (ch >= " ") {
        buf += ch;
        write(opts?.mask ? "*" : ch);
      }
      return "continue";
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const result = handleChar(ch);
        if (result === "done") {
          cleanup();
          write("\n");
          resume(Effect.succeed(buf));
          return;
        }
        if (result === "cancel") {
          cleanup();
          write("\n");
          resume(Effect.succeed(null));
          return;
        }
      }
    };

    process.stdin.on("data", onData);
  });
