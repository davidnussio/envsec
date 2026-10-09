export type Shell = "bash" | "zsh" | "fish" | "powershell";

/**
 * PowerShell treats the typographic single quotes as string delimiters too,
 * so each of them must be doubled like the ASCII one.
 */
const POWERSHELL_QUOTES = /['‘’‚‛]/gu;

/**
 * A statement that sets `key` to exactly `value` when evaluated by `sh`.
 * Values are single-quoted: POSIX shells take everything inside literally
 * (backslashes included), so only the quote itself needs escaping.
 */
export const formatExport = (key: string, value: string, sh: Shell): string => {
  switch (sh) {
    case "fish": {
      // fish single quotes still interpret \\ and \'
      const escaped = value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
      return `set -gx ${key} '${escaped}'`;
    }
    case "powershell": {
      const escaped = value.replaceAll(POWERSHELL_QUOTES, "$&$&");
      return `$env:${key} = '${escaped}'`;
    }
    default: {
      const escaped = value.replaceAll("'", "'\\''");
      return `export ${key}='${escaped}'`;
    }
  }
};

export const formatUnset = (key: string, sh: Shell): string => {
  switch (sh) {
    case "fish": {
      return `set -e ${key}`;
    }
    case "powershell": {
      return `Remove-Item Env:\\${key}`;
    }
    default: {
      return `unset ${key}`;
    }
  }
};
