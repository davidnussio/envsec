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
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text;

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

// ── Icons (Unicode only — no Nerd Fonts required) ───────────────────
export const icons = {
  success: green("✔"), // U+2714
  error: red("✖"), // U+2716
  warning: yellow("⚠"), // U+26A0
  info: blue("ℹ"), // U+2139
  key: yellow("🔑"), // U+1F511
  lock: green("🔒"), // U+1F512
  unlock: red("🔓"), // U+1F513
  search: blue("🔍"), // U+1F50D
  folder: blue("📁"), // U+1F4C1
  file: cyan("📄"), // U+1F4C4
  clock: yellow("🕐"), // U+1F550
  expired: red("⏰"), // U+23F0
  trash: red("🗑"), // U+1F5D1
  save: green("💾"), // U+1F4BE
  download: cyan("⬇"), // U+2B07
  upload: magenta("⬆"), // U+2B06
  shield: green("🛡"), // U+1F6E1
  chart: blue("📊"), // U+1F4CA
  bolt: yellow("⚡"), // U+26A1
  empty: dim("∅"), // U+2205
  arrow: dim("→"), // U+2192
  check: green("✅"), // U+2705
  cancel: dim("⊘"), // U+2298
  broom: yellow("🧹"), // U+1F9F9
  env: cyan("$"), // env var
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
