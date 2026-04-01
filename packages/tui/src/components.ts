/**
 * Reusable TUI components: menus, lists, status bar, etc.
 */

import { icons } from "@envsec/core";
import { c, cursor, getSize, screen, write, writeLine } from "./terminal.js";

// ── Header ──────────────────────────────────────────────────────────

export const renderHeader = (
  context: string | null,
  title: string,
  startRow = 1
): number => {
  const { cols } = getSize();
  const ctx = context ? c.cyan(`[${context}]`) : c.dim("[no context]");
  const line = `${c.bold(c.green(`${icons.lock} envsec`))} ${c.dim("›")} ${c.bold(title)}  ${ctx}`;
  writeLine(startRow, ` ${line}`);
  writeLine(startRow + 1, ` ${c.dim("─".repeat(Math.min(cols - 2, 60)))}`);
  return startRow + 2;
};

// ── Menu list ───────────────────────────────────────────────────────

export interface MenuItem {
  hint?: string;
  icon?: string;
  key: string;
  label: string;
}

export const renderMenu = (
  items: MenuItem[],
  selected: number,
  startRow: number,
  maxVisible?: number
): number => {
  const visible = maxVisible ?? items.length;
  const { rows } = getSize();
  const safeVisible = Math.min(visible, rows - startRow - 3);

  let offset = 0;
  if (selected >= offset + safeVisible) {
    offset = selected - safeVisible + 1;
  }
  if (selected < offset) {
    offset = selected;
  }

  let row = startRow;
  for (let i = offset; i < Math.min(items.length, offset + safeVisible); i++) {
    const item = items[i];
    if (!item) {
      continue;
    }
    const isSelected = i === selected;
    const prefix = isSelected ? c.cyan("❯") : " ";
    const icon = item.icon ?? "";
    const label = isSelected ? c.bold(c.cyan(item.label)) : item.label;
    const hint = item.hint ? `  ${c.dim(item.hint)}` : "";
    writeLine(row, ` ${prefix} ${icon}${icon ? " " : ""}${label}${hint}`);
    row++;
  }

  // Clear remaining lines
  for (let r = row; r < startRow + safeVisible; r++) {
    writeLine(r, "");
  }

  return row;
};

// ── Table ───────────────────────────────────────────────────────────

export interface TableColumn {
  align?: "left" | "right";
  header: string;
  width: number;
}

const calcOffset = (selected: number, visible: number): number => {
  if (selected >= visible) {
    return selected - visible + 1;
  }
  return 0;
};

export const renderTable = (
  columns: TableColumn[],
  rows: string[][],
  selected: number,
  startRow: number,
  maxVisible?: number
): number => {
  const { rows: termRows, cols } = getSize();
  const visible = Math.min(maxVisible ?? rows.length, termRows - startRow - 3);

  // Header
  let headerLine = " ";
  for (const col of columns) {
    const text = col.header.padEnd(col.width).slice(0, col.width);
    headerLine += `${c.bold(c.dim(text))} `;
  }
  writeLine(startRow, headerLine);
  writeLine(startRow + 1, ` ${c.dim("─".repeat(Math.min(cols - 2, 70)))}`);

  const offset = calcOffset(selected, visible);

  let row = startRow + 2;
  for (let i = offset; i < Math.min(rows.length, offset + visible); i++) {
    const data = rows[i];
    if (!data) {
      continue;
    }
    const isSelected = i === selected;
    const prefix = isSelected ? c.cyan("❯") : " ";
    const line = formatTableRow(data, columns, isSelected);
    writeLine(row, ` ${prefix} ${line}`);
    row++;
  }

  for (let r = row; r < startRow + 2 + visible; r++) {
    writeLine(r, "");
  }

  return row;
};

const formatTableRow = (
  data: string[],
  columns: TableColumn[],
  isSelected: boolean
): string => {
  let line = "";
  for (let j = 0; j < columns.length; j++) {
    const col = columns[j];
    if (!col) {
      continue;
    }
    const cell = (data[j] ?? "").slice(0, col.width);
    const padded =
      col.align === "right" ? cell.padStart(col.width) : cell.padEnd(col.width);
    line += `${isSelected ? c.cyan(padded) : padded} `;
  }
  return line;
};

// ── Status bar / footer ─────────────────────────────────────────────

export const renderFooter = (hints: string[], row?: number): void => {
  const { rows } = getSize();
  const r = row ?? rows;
  const text = hints.join(c.dim(" │ "));
  writeLine(r, ` ${c.dim(text)}`);
};

// ── Message / toast ─────────────────────────────────────────────────

export const renderMessage = (
  row: number,
  msg: string,
  type: "success" | "error" | "info" | "warning" = "info"
): void => {
  const iconMap = {
    success: icons.success,
    error: icons.error,
    warning: icons.warning,
    info: icons.info,
  };
  writeLine(row, ` ${iconMap[type]} ${msg}`);
};

// ── Screen management ───────────────────────────────────────────────

export const enterTUI = (): void => {
  write(screen.altBuffer);
  write(cursor.hide);
  write(screen.clear);
};

export const exitTUI = (): void => {
  write(cursor.show);
  write(screen.mainBuffer);
};

// ── Empty state ─────────────────────────────────────────────────────

export const renderEmpty = (row: number, message: string): number => {
  writeLine(row, "");
  writeLine(row + 1, `   ${icons.empty} ${c.dim(message)}`);
  writeLine(row + 2, "");
  return row + 3;
};
