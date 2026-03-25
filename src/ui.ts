/**
 * Centralized UI module for polished console output.
 * Uses ANSI escape codes for colors and Nerd Font icons.
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

// ── Nerd Font Icons ─────────────────────────────────────────────────
export const icons = {
  success: green("✔"), //  success / done
  error: red("✖"), //  error / failed
  warning: yellow("⚠"), //  warning
  info: blue("ℹ"), //  info
  key: yellow(""), //  nf-md-key
  lock: green(""), //  nf-md-lock
  unlock: red(""), //  nf-md-lock_open
  search: blue(""), //  nf-md-magnify
  folder: blue(""), //  nf-md-folder
  file: cyan(""), //  nf-md-file_document
  clock: yellow(""), //  nf-md-clock_outline
  expired: red(""), //  nf-md-clock_alert
  trash: red(""), //  nf-md-delete
  save: green(""), //  nf-md-content_save
  download: cyan(""), //  nf-md-download
  upload: magenta(""), //  nf-md-upload
  shield: green(""), //  nf-md-shield_lock
  chart: blue(""), //  nf-md-chart_bar
  bolt: yellow("⚡"), //  bolt / command
  empty: dim("∅"), //  empty set
  arrow: dim("→"), //  arrow
  check: green(""), //  nf-md-check_circle
  cancel: dim("⊘"), //  cancel
  broom: yellow(""), //  nf-md-broom
  env: cyan("$"), //  env var
} as const;

// ── Formatting Helpers ──────────────────────────────────────────────

/** Format a label: value pair with dimmed separator */
export const label = (name: string, value: string): string =>
  `${dim(`${name}:`)} ${value}`;

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
