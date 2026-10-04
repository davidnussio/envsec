/**
 * Centralized UI module for polished console output.
 * Uses ANSI escape codes for colors and standard Unicode icons.
 * Zero dependencies — works in any terminal with color support.
 */

const isColorSupported = (): boolean => {
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.FORCE_COLOR) {
    return true;
  }
  return process.stdout.isTTY ?? false;
};

const useColor = isColorSupported();

const ansi = (code: string) => (text: string) =>
  useColor ? `\u001B[${code}m${text}\u001B[0m` : text;

// ── Colors ──────────────────────────────────────────────────────────
export const green = ansi("32");
export const red = ansi("31");
export const yellow = ansi("33");
export const blue = ansi("34");
export const cyan = ansi("36");
export const magenta = ansi("35");
export const dim = ansi("2");
export const bold = ansi("1");
export const white = ansi("37");

// ── Icons (clean Unicode — no emoji, no Nerd Fonts) ─────────────────
export const icons = {
  // U+2192
  arrow: dim("→"),
  // U+203A
  bolt: yellow("›"),
  // tilde
  broom: yellow("~"),
  // U+2298
  cancel: dim("⊘"),
  // U+25AA
  chart: blue("▪"),
  // U+2714
  check: green("✔"),
  // U+25D4
  clock: yellow("◔"),
  // U+2B21
  dice: magenta("⬡"),
  // U+2193
  download: cyan("↓"),
  // U+2205
  empty: dim("∅"),
  // env var
  env: cyan("$"),
  // U+2716
  error: red("✖"),
  // U+2716
  expired: red("✖"),
  // U+00B7
  file: cyan("·"),
  // U+25B8
  folder: blue("▸"),
  // U+25CF
  info: blue("●"),
  // U+25C6
  key: yellow("◆"),
  // U+25A0
  lock: green("■"),
  // U+2193
  save: green("↓"),
  // U+25CE
  search: blue("◎"),
  // U+25B6
  shell: green("▶"),
  // U+25C8
  shield: green("◈"),
  // U+2714
  success: green("✔"),
  // U+00D7
  trash: red("×"),
  // U+25A1
  unlock: red("□"),
  // U+2191
  upload: magenta("↑"),
  // U+25B2
  warning: yellow("▲"),
} as const;

// ── Formatting Helpers ──────────────────────────────────────────────

/** Format a label: value pair with dimmed separator */
export const label = (name: string, value: string): string =>
  `${dim(name)}${dim(":")} ${value}`;

/** Format a count badge like "3 secrets" */
export const badge = (
  count: number,
  singular: string,
  plural?: string
): string => {
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${bold(String(count))} ${word}`;
};

/** Indent a line */
export const indent = (text: string, level = 1): string =>
  `${"  ".repeat(level)}${text}`;

/** Horizontal separator */
export const separator = (width = 40): string => dim("─".repeat(width));
