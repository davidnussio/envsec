/**
 * Centralized UI module for polished console output.
 * Uses ANSI escape codes for colors and standard Unicode icons.
 * Zero dependencies — works in any terminal with color support.
 */

/**
 * Whether to colour output written to `stream`. NO_COLOR (no-color.org)
 * disables colour; FORCE_COLOR enables it unless set to "0" or "false"
 * (as in Node.js); otherwise only a TTY gets colour.
 */
export const isColorEnabled = (
  stream: { readonly isTTY?: boolean },
  env: NodeJS.ProcessEnv = process.env
): boolean => {
  if (env.NO_COLOR) {
    return false;
  }
  const force = env.FORCE_COLOR;
  if (force !== undefined) {
    return force !== "0" && force !== "false";
  }
  return stream.isTTY ?? false;
};

/** Colours and icons for one output stream. */
const createUi = (useColor: boolean) => {
  const ansi = (code: string) => (text: string) =>
    useColor ? `\u001B[${code}m${text}\u001B[0m` : text;

  // ── Colors ────────────────────────────────────────────────────────
  const green = ansi("32");
  const red = ansi("31");
  const yellow = ansi("33");
  const blue = ansi("34");
  const cyan = ansi("36");
  const magenta = ansi("35");
  const dim = ansi("2");
  const bold = ansi("1");
  const white = ansi("37");

  // ── Icons (clean Unicode — no emoji, no Nerd Fonts) ───────────────
  const icons = {
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

  // ── Formatting Helpers ────────────────────────────────────────────

  /** Format a label: value pair with dimmed separator */
  const label = (name: string, value: string): string =>
    `${dim(name)}${dim(":")} ${value}`;

  /** Format a count badge like "3 secrets" */
  const badge = (count: number, singular: string, plural?: string): string => {
    const word = count === 1 ? singular : (plural ?? `${singular}s`);
    return `${bold(String(count))} ${word}`;
  };

  /** Horizontal separator */
  const separator = (width = 40): string => dim("─".repeat(width));

  return {
    badge,
    blue,
    bold,
    cyan,
    dim,
    green,
    icons,
    label,
    magenta,
    red,
    separator,
    white,
    yellow,
  };
};

/** Indent a line */
export const indent = (text: string, level = 1): string =>
  `${"  ".repeat(level)}${text}`;

/** Styling for stdout, where command output goes. */
export const {
  badge,
  blue,
  bold,
  cyan,
  dim,
  green,
  icons,
  label,
  magenta,
  red,
  separator,
  white,
  yellow,
} = createUi(isColorEnabled(process.stdout));

/**
 * Styling for stderr (warnings, errors, notices). Coloured on its own TTY
 * check: `envsec env | ...` pipes stdout while stderr is still a terminal.
 */
export const stderrUi = createUi(isColorEnabled(process.stderr));
