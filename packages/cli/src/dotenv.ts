/**
 * The dotenv parser shared by `envsec load` and `envsec rescue`.
 *
 * Follows the common dotenv dialect: `export` prefixes, single/double/backtick
 * quotes (double quotes expand `\n`, `\t`, `\"`, `\\`), multi-line quoted
 * values, and ` #` inline comments on unquoted values. It reads back exactly
 * what `envsec env-file` writes.
 */

export interface DotenvEntry {
  /** 1-based line where the assignment starts. */
  readonly line: number;
  /** The variable name as written (e.g. `API_TOKEN`). */
  readonly name: string;
  readonly value: string;
}

const assignmentPattern =
  /^(?:export\s+)?(?<name>[A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(?<rest>.*)$/u;
const inlineCommentPattern = /\s+#.*$/u;
const byteOrderMark = /^\uFEFF/u;
const quotes = new Set(['"', "'", "`"]);

const doubleQuoteEscapes: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  n: "\n",
  r: "\r",
  t: "\t",
};

/** Index of the closing quote in `text`, honouring backslash escapes for `"`. */
const findClosingQuote = (text: string, quote: string): number => {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote === '"' && ch === "\\") {
      i += 1;
    } else if (ch === quote) {
      return i;
    }
  }
  return -1;
};

const unescapeDoubleQuoted = (raw: string): string =>
  raw.replaceAll(
    /\\(?<ch>.)/gu,
    (match, ch: string) => doubleQuoteEscapes[ch] ?? match
  );

/**
 * Read a quoted value starting right after the opening quote on `lines[start]`,
 * continuing onto following lines until the closing quote.
 * Returns the value and the index of the last line consumed, or null when the
 * quote is never closed.
 */
const readQuoted = (
  lines: readonly string[],
  start: number,
  firstChunk: string,
  quote: string
): { readonly end: number; readonly value: string } | null => {
  let buffer = firstChunk;
  for (let index = start; index < lines.length; index += 1) {
    const close = findClosingQuote(buffer, quote);
    if (close !== -1) {
      const raw = buffer.slice(0, close);
      const value = quote === '"' ? unescapeDoubleQuoted(raw) : raw;
      return { end: index, value };
    }
    const next = lines[index + 1];
    if (next === undefined) {
      return null;
    }
    buffer = `${buffer}\n${next}`;
  }
  return null;
};

export const parseDotenv = (content: string): DotenvEntry[] => {
  // Editors on Windows often save UTF-8 with a BOM, which would otherwise
  // end up in the first variable name.
  const lines = content
    .replace(byteOrderMark, "")
    .replaceAll("\r\n", "\n")
    .split("\n");
  const entries: DotenvEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = assignmentPattern.exec((lines[index] ?? "").trim());
    if (!match) {
      continue;
    }
    const { name = "", rest = "" } = match.groups ?? {};
    const quote = rest[0] ?? "";

    if (!quotes.has(quote)) {
      const value = rest.replace(inlineCommentPattern, "").trim();
      entries.push({ line: index + 1, name, value });
      continue;
    }

    const quoted = readQuoted(lines, index, rest.slice(1), quote);
    if (!quoted) {
      // Unterminated quote: keep the rest of the line verbatim.
      entries.push({ line: index + 1, name, value: rest });
      continue;
    }
    entries.push({ line: index + 1, name, value: quoted.value });
    index = quoted.end;
  }

  return entries;
};

/** `API_TOKEN` → `api.token`: how env var names map to envsec keys. */
export const toSecretKey = (name: string): string =>
  name.toLowerCase().replaceAll("_", ".");
