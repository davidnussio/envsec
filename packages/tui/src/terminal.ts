/**
 * Low-level terminal helpers for the interactive TUI.
 * Raw ANSI escape sequences — zero dependencies.
 */

import { isColorEnabled } from "@envsec/core";
import { Effect } from "effect";

// ── ANSI escape sequences ───────────────────────────────────────────

export const ESC = "\u001B";
export const CSI = `${ESC}[`;

export const cursor = {
  hide: `${CSI}?25l`,
  moveDown: (n = 1) => `${CSI}${n}B`,
  moveTo: (row: number, col: number) => `${CSI}${row};${col}H`,
  moveUp: (n = 1) => `${CSI}${n}A`,
  restoreCursor: `${ESC}8`,
  saveCursor: `${ESC}7`,
  show: `${CSI}?25h`,
};

export const screen = {
  altBuffer: `${CSI}?1049h`,
  clear: `${CSI}2J`,
  clearDown: `${CSI}J`,
  clearLine: `${CSI}2K`,
  mainBuffer: `${CSI}?1049l`,
};

// ── Colors (reuse project conventions) ──────────────────────────────

const useColor = isColorEnabled(process.stdout);

const ansi = (code: string) => (text: string) =>
  useColor ? `\u001B[${code}m${text}\u001B[0m` : text;

export const c = {
  bgBlue: ansi("44"),
  bgCyan: ansi("46"),
  bgGreen: ansi("42"),
  bgRed: ansi("41"),
  bgWhite: ansi("47;30"),
  bgYellow: ansi("43"),
  blue: ansi("34"),
  bold: ansi("1"),
  cyan: ansi("36"),
  dim: ansi("2"),
  gray: ansi("90"),
  green: ansi("32"),
  inverse: ansi("7"),
  italic: ansi("3"),
  magenta: ansi("35"),
  red: ansi("31"),
  underline: ansi("4"),
  white: ansi("37"),
  yellow: ansi("33"),
};

// ── Terminal size ───────────────────────────────────────────────────

// Some pseudo-terminals report a size of 0: fall back to the defaults.
export const getSize = (): { rows: number; cols: number } => ({
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows || 24,
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
  "\u0003": { ctrl: true, name: "c" },
  "\u0004": { ctrl: true, name: "d" },
  "\u001A": { ctrl: true, name: "z" },
};

const SPECIAL_KEYS: Record<string, string> = {
  "\b": "backspace",
  "\t": "tab",
  "\n": "return",
  "\r": "return",
  "\u001B": "escape",
  "\u001B[1~": "home",
  "\u001B[4~": "end",
  "\u001B[5~": "pageup",
  "\u001B[6~": "pagedown",
  "\u001B[A": "up",
  "\u001B[B": "down",
  "\u001B[C": "right",
  "\u001B[D": "left",
  "\u001B[F": "end",
  "\u001B[H": "home",
  " ": "space",
  "\u007F": "backspace",
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

export const readKey: Effect.Effect<KeyPress> = Effect.callback<KeyPress>(
  (resume) => {
    const { stdin } = process;
    // stdin closed: nothing more can be read, end the TUI session.
    if (stdin.readableEnded) {
      resume(Effect.interrupt);
      return;
    }
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    // The listeners and their cleanup reference each other, so they live
    // on one object: each handler detaches both listeners before resuming.
    const listeners = {
      cleanup: () => {
        stdin.removeListener("data", listeners.onData);
        stdin.removeListener("end", listeners.onEnd);
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw);
        }
        stdin.pause();
      },
      onData: (data: Buffer) => {
        listeners.cleanup();
        resume(Effect.succeed(parseKey(data)));
      },
      onEnd: () => {
        listeners.cleanup();
        resume(Effect.interrupt);
      },
    };

    stdin.on("data", listeners.onData);
    stdin.on("end", listeners.onEnd);

    // Runs if the fiber is interrupted while waiting (SIGINT/SIGTERM).
    return Effect.sync(listeners.cleanup);
  }
);

// ── Bracketed input reading (for text fields) ──────────────────────

export const readLine = (
  prompt: string,
  opts?: { mask?: boolean }
): Effect.Effect<string | null> =>
  Effect.callback<string | null>((resume) => {
    write(prompt);
    const { stdin } = process;
    if (stdin.readableEnded) {
      resume(Effect.interrupt);
      return;
    }
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding("utf-8");

    let buf = "";

    const handleChar = (ch: string): "cancel" | "continue" | "done" => {
      if (ch === "\r" || ch === "\n") {
        return "done";
      }
      if (ch === "\u0003") {
        return "cancel";
      }
      if (ch === "\u007F" || ch === "\b") {
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

    // The listeners and their cleanup reference each other, so they live
    // on one object: each handler detaches both listeners before resuming.
    const listeners = {
      cleanup: () => {
        stdin.removeListener("data", listeners.onData);
        stdin.removeListener("end", listeners.onEnd);
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw);
        }
        stdin.pause();
      },
      onData: (chunk: string) => {
        // Bare escape key (not part of an ANSI sequence like \u001B[A)
        if (chunk === "\u001B") {
          listeners.cleanup();
          write("\n");
          resume(Effect.succeed(null));
          return;
        }
        for (const ch of chunk) {
          // Skip escape bytes that are part of ANSI sequences
          if (ch === "\u001B") {
            continue;
          }
          const result = handleChar(ch);
          if (result === "done") {
            listeners.cleanup();
            write("\n");
            resume(Effect.succeed(buf));
            return;
          }
          if (result === "cancel") {
            listeners.cleanup();
            write("\n");
            resume(Effect.succeed(null));
            return;
          }
        }
      },
      onEnd: () => {
        listeners.cleanup();
        resume(Effect.interrupt);
      },
    };

    stdin.on("data", listeners.onData);
    stdin.on("end", listeners.onEnd);

    // Runs if the fiber is interrupted while waiting (SIGINT/SIGTERM).
    return Effect.sync(listeners.cleanup);
  });
