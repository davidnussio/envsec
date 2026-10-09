/**
 * TUI views — each view is a self-contained interactive screen.
 * All views consume SecretStore via Effect dependency injection.
 */

import { existsSync, readFileSync } from "node:fs";
import nodePath from "node:path";

import {
  expiresAtFromNow,
  FileAccessError,
  formatTimeDistance,
  icons,
  parseDuration,
  SecretStore,
  writePrivateFile,
} from "@envsec/core";
import type { EnvFileExport, SecretMetadata } from "@envsec/core";
import { Effect, Option } from "effect";

import {
  renderEmpty,
  renderFooter,
  renderHeader,
  renderMenu,
  renderMessage,
  renderTable,
} from "./components.js";
import {
  c,
  cursor,
  readKey,
  readLine,
  screen,
  write,
  writeLine,
} from "./terminal.js";

// ── Types ───────────────────────────────────────────────────────────

type ViewResult = "back" | "quit" | "refresh";
type ContextsViewResult = ViewResult | { setContext: string } | "clearContext";

// ── Select Context (arrow navigation) ───────────────────────────────

const selectContext = Effect.fn("tui.selectContext")(function* selectContext(
  title: string
) {
  const contexts = yield* SecretStore.listContexts().pipe(
    Effect.catch(() => Effect.succeed([]))
  );

  if (contexts.length === 0) {
    write(screen.clear);
    renderHeader(null, title);
    renderEmpty(4, "No contexts found. Add secrets to create one.");
    renderFooter(["any key to go back"]);
    yield* readKey;
    return null;
  }

  let selected = 0;

  while (true) {
    write(screen.clear);
    let row = renderHeader(null, title);
    row += 1;

    const items = contexts.map((ctx) => ({
      hint: `${ctx.count} secrets`,
      icon: icons.folder,
      key: ctx.context,
      label: ctx.context,
    }));

    selected = Math.min(selected, items.length - 1);
    row = renderMenu(items, selected, row);
    renderFooter(["↑↓ navigate", "Enter select", "Esc back"]);

    const key = yield* readKey;

    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      return null;
    }
    if (key.name === "up") {
      selected = (selected - 1 + items.length) % items.length;
      continue;
    }
    if (key.name === "down") {
      selected = (selected + 1) % items.length;
      continue;
    }
    if (key.name === "return") {
      const ctx = contexts[selected];
      return ctx ? ctx.context : null;
    }
  }
});

// ── Confirm delete context ──────────────────────────────────────────

const confirmDeleteContext = Effect.fn("tui.confirmDeleteContext")(
  function* confirmDeleteContext(context: string) {
    write(screen.clear);
    renderHeader(context, "Delete All Secrets");
    writeLine(
      5,
      ` ${icons.warning} ${c.bold("Delete ALL secrets")} in context ${c.bold(c.cyan(`"${context}"`))}?`
    );
    writeLine(7, ` ${c.dim("This cannot be undone.")}`);
    writeLine(
      9,
      ` ${c.green("y")} confirm  ${c.dim("/")}  ${c.red("n")} cancel  ${c.dim("/")}  ${c.dim("Esc")} back`
    );

    const key = yield* readKey;
    if (key.name === "y") {
      const secrets = yield* SecretStore.list(context).pipe(
        Effect.catch(() => Effect.succeed([]))
      );
      yield* SecretStore.withBatch(
        Effect.forEach(
          secrets,
          (s) =>
            SecretStore.remove(context, s.key).pipe(
              Effect.catch(() => Effect.void)
            ),
          { discard: true }
        )
      ).pipe(Effect.catch(() => Effect.void));
      return true;
    }
    return false;
  }
);

// ── Reveal Secret View ──────────────────────────────────────────────

const revealSecretView = Effect.fn("tui.revealSecretView")(
  function* revealSecretView(context: string, key: string) {
    write(screen.clear);
    let row = renderHeader(context, "Secret Detail");
    row += 1;

    const meta = yield* SecretStore.getMetadata(context, key).pipe(
      Effect.catch(() => Effect.succeed(null))
    );

    writeLine(row, ` ${c.bold("Key:")}     ${c.cyan(key)}`);
    row += 1;

    if (meta) {
      writeLine(row, ` ${c.bold("Created:")} ${c.dim(meta.created_at)}`);
      row += 1;
      writeLine(row, ` ${c.bold("Updated:")} ${c.dim(meta.updated_at)}`);
      row += 1;
      writeLine(
        row,
        ` ${c.bold("Expires:")} ${meta.expires_at ? c.yellow(meta.expires_at) : c.dim("never")}`
      );
      row += 1;
    }

    row += 1;
    writeLine(row, ` ${c.dim("Press 'r' to reveal value, Esc to go back")}`);

    renderFooter(["r reveal value", "Esc back", "q quit"]);

    while (true) {
      const k = yield* readKey;
      if (k.name === "q" || (k.ctrl && k.name === "c")) {
        return "quit" as ViewResult;
      }
      if (k.name === "escape") {
        return "back" as ViewResult;
      }

      if (k.name === "r") {
        const value = yield* SecretStore.get(context, key).pipe(
          Effect.catch((error) => Effect.succeed(`[error: ${error._tag}]`))
        );
        row += 1;
        writeLine(row, ` ${c.bold("Value:")}   ${c.green(String(value))}`);
        row += 2;
        writeLine(
          row,
          ` ${c.dim("Press any key to go back (value will be hidden)")}`
        );
        renderFooter(["any key to go back"]);
        yield* readKey;
        return "back" as ViewResult;
      }
    }
  }
);

// ── Confirm Delete ──────────────────────────────────────────────────

const confirmDelete = Effect.fn("tui.confirmDelete")(function* confirmDelete(
  context: string,
  key: string
) {
  write(screen.clear);
  renderHeader(context, "Delete Secret");
  writeLine(
    5,
    ` ${icons.warning} Delete secret ${c.bold(c.cyan(`"${key}"`))}?`
  );
  writeLine(
    7,
    ` ${c.green("y")} confirm  ${c.dim("/")}  ${c.red("n")} cancel  ${c.dim("/")}  ${c.dim("Esc")} back`
  );

  const k = yield* readKey;
  if (k.name === "y") {
    yield* SecretStore.remove(context, key).pipe(
      Effect.catch(() => Effect.void)
    );
    return true;
  }
  return false;
});

// ── Add Secret View ─────────────────────────────────────────────────

const addSecretView = Effect.fn("tui.addSecretView")(function* addSecretView(
  context: string
) {
  write(screen.clear);
  let row = renderHeader(context, "Add Secret");
  row += 1;

  write(cursor.show);

  writeLine(row, "");
  row += 1;
  const key = yield* readLine(` ${c.cyan("Key:")} `);
  if (key === null || key.trim() === "") {
    write(cursor.hide);
    return "back" as ViewResult;
  }

  const value = yield* readLine(` ${c.cyan("Value:")} `, { mask: true });
  if (value === null || value.trim() === "") {
    write(cursor.hide);
    return "back" as ViewResult;
  }

  const expiresInput = yield* readLine(
    ` ${c.cyan("Expires (e.g. 30d, 1y, empty for never):")} `
  );

  write(cursor.hide);

  // An invalid duration is reported instead of silently storing the
  // secret without an expiry.
  const outcome = yield* Effect.gen(function* outcome() {
    const expiresAt =
      expiresInput && expiresInput.trim() !== ""
        ? expiresAtFromNow(yield* parseDuration(expiresInput.trim()))
        : null;
    yield* SecretStore.set(context, key.trim(), value, expiresAt);
  }).pipe(
    Effect.match({
      onFailure: (e) => ({ message: `Error: ${e.message}`, ok: false }),
      onSuccess: () => ({
        message: `Secret "${key.trim()}" stored`,
        ok: true,
      }),
    })
  );

  row += 2;
  renderMessage(row, outcome.message, outcome.ok ? "success" : "error");
  row += 1;
  writeLine(row, ` ${c.dim("Press any key to continue...")}`);
  yield* readKey;

  return "back" as ViewResult;
});

// ── Secrets View ────────────────────────────────────────────────────

const secretsView = Effect.fn("tui.secretsView")(
  // oxlint-disable-next-line complexity -- interactive TUI loop: one key dispatch per branch
  function* secretsView(context: string) {
    let selected = 0;
    let message: {
      text: string;
      type: "success" | "error" | "info" | "warning";
    } | null = null;

    while (true) {
      const secrets = yield* SecretStore.list(context).pipe(
        Effect.catch(() => Effect.succeed([] as SecretMetadata[]))
      );

      write(screen.clear);
      let row = renderHeader(context, "Secrets");
      row += 1;

      if (secrets.length === 0) {
        row = renderEmpty(row, "No secrets in this context.");
        renderFooter(["a add secret", "Esc back", "q quit"]);
        if (message) {
          renderMessage(row, message.text, message.type);
        }
        const key = yield* readKey;
        message = null;
        if (key.name === "q" || (key.ctrl && key.name === "c")) {
          return "quit" as ViewResult;
        }
        if (key.name === "escape") {
          return "back" as ViewResult;
        }
        if (key.name === "a") {
          yield* addSecretView(context);
          continue;
        }
        continue;
      }

      selected = Math.min(selected, secrets.length - 1);

      const columns = [
        { header: "KEY", width: 30 },
        { header: "UPDATED", width: 20 },
        { header: "EXPIRES", width: 20 },
      ];

      const tableRows = secrets.map((s) => [
        s.key,
        s.updated_at.slice(0, 16).replace("T", " "),
        s.expires_at
          ? s.expires_at.slice(0, 16).replace("T", " ")
          : c.dim("never"),
      ]);

      row = renderTable(columns, tableRows, selected, row);
      row += 1;

      if (message) {
        renderMessage(row, message.text, message.type);
        row += 1;
      }

      writeLine(row + 1, ` ${c.dim(`${secrets.length} secrets`)}`);

      renderFooter([
        "↑↓ navigate",
        "Enter reveal",
        "a add",
        "d delete",
        "Esc back",
        "q quit",
      ]);

      const key = yield* readKey;
      message = null;

      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        return "quit" as ViewResult;
      }
      if (key.name === "escape") {
        return "back" as ViewResult;
      }
      if (key.name === "up") {
        selected = (selected - 1 + secrets.length) % secrets.length;
      }
      if (key.name === "down") {
        selected = (selected + 1) % secrets.length;
      }

      if (key.name === "return") {
        const secret = secrets[selected];
        if (secret) {
          yield* revealSecretView(context, secret.key);
        }
      }

      if (key.name === "a") {
        yield* addSecretView(context);
      }

      if (key.name === "d") {
        const secret = secrets[selected];
        if (secret) {
          const confirmed = yield* confirmDelete(context, secret.key);
          if (confirmed) {
            message = { text: `Deleted "${secret.key}"`, type: "success" };
          }
        }
      }
    }
  }
);

// ── Contexts View ───────────────────────────────────────────────────

const contextsView = Effect.fn("tui.contextsView")(function* contextsView() {
  let selected = 0;

  while (true) {
    const contexts = yield* SecretStore.listContexts().pipe(
      Effect.catch(() => Effect.succeed([]))
    );

    write(screen.clear);
    let row = renderHeader(null, "Contexts");
    row += 1;

    if (contexts.length === 0) {
      row = renderEmpty(row, "No contexts found. Add secrets to create one.");
      renderFooter(["Esc back", "q quit"]);
      const key = yield* readKey;
      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        return "quit" as ContextsViewResult;
      }
      return "back" as ContextsViewResult;
    }

    const items = contexts.map((ctx) => ({
      hint: `${ctx.count} secrets`,
      icon: icons.folder,
      key: ctx.context,
      label: ctx.context,
    }));

    selected = Math.min(selected, items.length - 1);
    row = renderMenu(items, selected, row);
    row += 1;
    renderFooter([
      "↑↓ navigate",
      "Enter view secrets",
      "s set context",
      "x clear context",
      "d delete all",
      "Esc back",
      "q quit",
    ]);

    const key = yield* readKey;

    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      return "quit" as ContextsViewResult;
    }
    if (key.name === "escape") {
      return "back" as ContextsViewResult;
    }
    if (key.name === "up") {
      selected = (selected - 1 + items.length) % items.length;
    }
    if (key.name === "down") {
      selected = (selected + 1) % items.length;
    }

    if (key.name === "s") {
      const ctx = contexts[selected];
      if (ctx) {
        return { setContext: ctx.context } as ContextsViewResult;
      }
    }

    if (key.name === "x") {
      return "clearContext" as ContextsViewResult;
    }

    if (key.name === "return") {
      const ctx = contexts[selected];
      if (ctx) {
        const result = yield* secretsView(ctx.context);
        if (result === "quit") {
          return "quit" as ContextsViewResult;
        }
      }
    }

    if (key.name === "d") {
      const ctx = contexts[selected];
      if (ctx) {
        yield* confirmDeleteContext(ctx.context);
      }
    }
  }
});

// ── Search View ─────────────────────────────────────────────────────

const searchView = Effect.fn("tui.searchView")(function* searchView(
  context: string | null
) {
  write(screen.clear);
  let row = renderHeader(context, "Search");
  row += 1;

  write(cursor.show);
  writeLine(row, ` ${c.cyan("Pattern (glob):")}`);
  row += 1;
  const pattern = yield* readLine(` ${c.dim("›")} `);
  write(cursor.hide);

  if (pattern === null || pattern.trim() === "") {
    return "back" as ViewResult;
  }

  row += 2;

  if (context) {
    const results = yield* SecretStore.search(context, pattern.trim()).pipe(
      Effect.catch(() => Effect.succeed([]))
    );

    if (results.length === 0) {
      renderMessage(row, "No secrets found.", "info");
    } else {
      writeLine(row, ` ${c.bold(`${results.length} results:`)}`);
      row += 1;
      for (const r of results.slice(0, 20)) {
        writeLine(row, `   ${icons.key} ${r.key}`);
        row += 1;
      }
    }
  } else {
    const results = yield* SecretStore.searchContexts(pattern.trim()).pipe(
      Effect.catch(() => Effect.succeed([]))
    );

    if (results.length === 0) {
      renderMessage(row, "No contexts found.", "info");
    } else {
      writeLine(row, ` ${c.bold(`${results.length} contexts:`)}`);
      row += 1;
      for (const r of results.slice(0, 20)) {
        writeLine(
          row,
          `   ${icons.folder} ${r.context} ${c.dim(`(${r.count} secrets)`)}`
        );
        row += 1;
      }
    }
  }

  row += 2;
  writeLine(row, ` ${c.dim("Press any key to continue...")}`);
  yield* readKey;
  return "back" as ViewResult;
});

// ── Commands View ───────────────────────────────────────────────────

const commandsView = Effect.fn("tui.commandsView")(function* commandsView() {
  let selected = 0;

  while (true) {
    const commands = yield* SecretStore.listCommands().pipe(
      Effect.catch(() => Effect.succeed([]))
    );

    write(screen.clear);
    let row = renderHeader(null, "Saved Commands");
    row += 1;

    if (commands.length === 0) {
      row = renderEmpty(row, "No saved commands.");
      renderFooter(["Esc back", "q quit"]);
      const key = yield* readKey;
      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        return "quit" as ViewResult;
      }
      return "back" as ViewResult;
    }

    selected = Math.min(selected, commands.length - 1);

    const columns = [
      { header: "NAME", width: 20 },
      { header: "COMMAND", width: 30 },
      { header: "CONTEXT", width: 20 },
    ];

    const tableRows = commands.map((cmd) => [
      cmd.name,
      cmd.command.length > 30 ? `${cmd.command.slice(0, 27)}...` : cmd.command,
      cmd.context,
    ]);

    row = renderTable(columns, tableRows, selected, row);
    row += 1;
    writeLine(row, ` ${c.dim(`${commands.length} commands`)}`);

    renderFooter(["↑↓ navigate", "d delete", "Esc back", "q quit"]);

    const key = yield* readKey;

    if (key.name === "q" || (key.ctrl && key.name === "c")) {
      return "quit" as ViewResult;
    }
    if (key.name === "escape") {
      return "back" as ViewResult;
    }
    if (key.name === "up") {
      selected = (selected - 1 + commands.length) % commands.length;
    }
    if (key.name === "down") {
      selected = (selected + 1) % commands.length;
    }

    if (key.name === "d") {
      const cmd = commands[selected];
      if (cmd) {
        yield* SecretStore.removeCommand(cmd.name).pipe(
          Effect.catch(() => Effect.void)
        );
      }
    }
  }
});

// ── Env file exports (audit subsection) ─────────────────────────────

const renderEnvFileExports = Effect.fn("tui.renderEnvFileExports")(
  function* renderEnvFileExports(
    startRow: number,
    contextFilter: string | null
  ) {
    let row = startRow;

    const allExports = yield* SecretStore.listEnvFileExports().pipe(
      Effect.catch(() => Effect.succeed([] as EnvFileExport[]))
    );

    // Prune stale exports (files no longer on disk)
    const alive: EnvFileExport[] = [];
    const stale: EnvFileExport[] = [];
    for (const e of allExports) {
      if (existsSync(e.path)) {
        alive.push(e);
      } else {
        stale.push(e);
      }
    }
    for (const e of stale) {
      yield* SecretStore.removeEnvFileExport(e.path).pipe(
        Effect.catch(() => Effect.void)
      );
    }

    if (stale.length > 0) {
      row += 2;
      writeLine(
        row,
        ` ${icons.broom} Removed ${c.bold(String(stale.length))} stale env file record${stale.length === 1 ? "" : "s"} ${c.dim("(files no longer on disk)")}`
      );
    }

    const filtered = contextFilter
      ? alive.filter((e) => e.context === contextFilter)
      : alive;

    if (filtered.length === 0) {
      return row;
    }

    row += 2;
    writeLine(row, ` ${icons.file} ${c.bold("Generated .env files:")}`);
    row += 1;

    for (const e of filtered) {
      const date = e.created_at.replace("T", " ").slice(0, 19);
      row += 1;
      writeLine(row, `   ${icons.file} ${e.path}`);
      row += 1;
      writeLine(
        row,
        `     ${c.dim(`context: ${e.context}  generated: ${date}`)}`
      );
    }

    row += 2;
    writeLine(
      row,
      ` ${icons.chart} ${c.bold(String(filtered.length))} env file${filtered.length === 1 ? "" : "s"} generated`
    );

    return row;
  }
);

// ── Audit View ──────────────────────────────────────────────────────

const auditView = Effect.fn("tui.auditView")(function* auditView(
  context: string | null
) {
  write(screen.clear);
  let row = renderHeader(context, "Audit — Expiring Secrets");
  row += 1;

  // 30 days
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (context) {
    const secrets = yield* SecretStore.listExpiring(context, windowMs).pipe(
      Effect.catch(() => Effect.succeed([]))
    );

    if (secrets.length === 0) {
      renderMessage(row, "No secrets expiring within 30 days.", "success");
    } else {
      writeLine(
        row,
        ` ${c.bold(`${secrets.length} secrets expiring within 30 days:`)}`
      );
      row += 2;
      for (const s of secrets.slice(0, 20)) {
        const expired = s.expires_at
          ? new Date(`${s.expires_at}Z`).getTime() <= now
          : false;
        const icon = expired ? icons.expired : icons.clock;
        const status = expired ? c.red("EXPIRED") : c.yellow("expiring");
        const distance = s.expires_at ? formatTimeDistance(s.expires_at) : "";
        writeLine(row, `   ${icon} ${s.key}  ${status}  ${c.dim(distance)}`);
        row += 1;
      }
    }
  } else {
    const secrets = yield* SecretStore.listAllExpiring(windowMs).pipe(
      Effect.catch(() => Effect.succeed([]))
    );

    if (secrets.length === 0) {
      renderMessage(
        row,
        "No secrets expiring within 30 days across all contexts.",
        "success"
      );
    } else {
      writeLine(
        row,
        ` ${c.bold(`${secrets.length} secrets expiring within 30 days:`)}`
      );
      row += 2;
      for (const s of secrets.slice(0, 20)) {
        const expired = s.expires_at
          ? new Date(`${s.expires_at}Z`).getTime() <= now
          : false;
        const icon = expired ? icons.expired : icons.clock;
        const status = expired ? c.red("EXPIRED") : c.yellow("expiring");
        const distance = s.expires_at ? formatTimeDistance(s.expires_at) : "";
        writeLine(
          row,
          `   ${icon} ${c.dim(`[${s.env}]`)} ${s.key}  ${status}  ${c.dim(distance)}`
        );
        row += 1;
      }
    }
  }

  // ── Env file exports ──────────────────────────────────────────────
  row = yield* renderEnvFileExports(row, context);

  row += 2;
  writeLine(row, ` ${c.dim("Press any key to continue...")}`);
  renderFooter(["any key to go back"]);
  yield* readKey;
  return "back" as ViewResult;
});

// ── Import View ─────────────────────────────────────────────────────

const importView = Effect.fn("tui.importView")(function* importView(
  context: string
) {
  write(screen.clear);
  let row = renderHeader(context, "Import .env File");
  row += 1;

  write(cursor.show);
  writeLine(row, ` ${c.cyan("File path (default: .env):")}`);
  row += 1;
  const filePath = yield* readLine(` ${c.dim("›")} `);
  write(cursor.hide);

  if (filePath === null) {
    return "back" as ViewResult;
  }

  const path = filePath.trim() === "" ? ".env" : filePath.trim();

  row += 2;
  writeLine(row, ` ${c.dim("Reading")} ${path}${c.dim("...")}`);

  const content = yield* Effect.try({
    catch: (cause) =>
      new FileAccessError({
        cause,
        message: `Cannot read file: ${path}`,
        path,
      }),
    try: () => readFileSync(path, "utf-8"),
  }).pipe(
    Effect.catch((error) => {
      renderMessage(row + 1, error.message, "error");
      return Effect.succeed(null);
    })
  );

  if (content === null) {
    row += 3;
    writeLine(row, ` ${c.dim("Press any key to continue...")}`);
    yield* readKey;
    return "back" as ViewResult;
  }

  const lines = content.split("\n");
  let added = 0;
  let failed = 0;

  const importAll = Effect.gen(function* importAll() {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        continue;
      }
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed
        .slice(eqIndex + 1)
        .trim()
        .replaceAll(/^["']|["']$/gu, "");
      const secretKey = key.toLowerCase().replaceAll("_", ".");
      const stored = yield* SecretStore.set(context, secretKey, value).pipe(
        Effect.as(true),
        Effect.catch(() => Effect.succeed(false))
      );
      if (stored) {
        added += 1;
      } else {
        failed += 1;
      }
    }
  });

  const batchOk = yield* SecretStore.withBatch(importAll).pipe(
    Effect.as(true),
    Effect.catch(() => Effect.succeed(false))
  );

  row += 1;
  if (batchOk && failed === 0) {
    renderMessage(row, `Imported ${added} secrets from ${path}`, "success");
  } else if (batchOk) {
    renderMessage(
      row,
      `Imported ${added} secrets from ${path}, ${failed} failed`,
      "error"
    );
  } else {
    renderMessage(row, "Failed to save secret metadata", "error");
  }
  row += 2;
  writeLine(row, ` ${c.dim("Press any key to continue...")}`);
  yield* readKey;
  return "back" as ViewResult;
});

// ── Export View ─────────────────────────────────────────────────────

const exportView = Effect.fn("tui.exportView")(function* exportView(
  context: string
) {
  write(screen.clear);
  let row = renderHeader(context, "Export .env File");
  row += 1;

  write(cursor.show);
  writeLine(row, ` ${c.cyan("Output path (default: .env):")}`);
  row += 1;
  const filePath = yield* readLine(` ${c.dim("›")} `);
  write(cursor.hide);

  if (filePath === null) {
    return "back" as ViewResult;
  }

  const path = filePath.trim() === "" ? ".env" : filePath.trim();

  row += 2;
  writeLine(row, ` ${c.dim("Exporting secrets...")}`);

  const secrets = yield* SecretStore.list(context).pipe(
    Effect.catch(() => Effect.succeed([] as SecretMetadata[]))
  );

  if (secrets.length === 0) {
    row += 1;
    renderMessage(row, "No secrets to export.", "info");
    row += 2;
    writeLine(row, ` ${c.dim("Press any key to continue...")}`);
    yield* readKey;
    return "back" as ViewResult;
  }

  const lines: string[] = [];
  const unreadable: string[] = [];
  for (const item of secrets) {
    const value = yield* SecretStore.get(context, item.key).pipe(Effect.option);
    if (Option.isNone(value)) {
      unreadable.push(item.key);
      continue;
    }
    const envKey = item.key.toUpperCase().replaceAll(".", "_");
    const escaped = value.value
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"')
      .replaceAll("\n", "\\n");
    lines.push(`${envKey}="${escaped}"`);
  }

  // Never write a .env with silently empty values: abort if any secret
  // could not be read, and only track exports that were actually written.
  const outcome =
    unreadable.length > 0
      ? {
          message: `Cannot read ${unreadable.length} secret(s): ${unreadable.join(", ")}. Nothing exported.`,
          ok: false,
        }
      : yield* Effect.try({
          catch: (cause) =>
            new FileAccessError({
              cause,
              message: `Failed to write: ${path}`,
              path,
            }),
          try: () => writePrivateFile(path, `${lines.join("\n")}\n`),
        }).pipe(
          Effect.tap(() =>
            SecretStore.trackEnvFileExport(
              context,
              nodePath.resolve(path)
            ).pipe(Effect.ignore)
          ),
          Effect.match({
            onFailure: (e) => ({ message: e.message, ok: false }),
            onSuccess: () => ({
              message: `Exported ${lines.length} secrets to ${path}`,
              ok: true,
            }),
          })
        );

  row += 1;
  renderMessage(row, outcome.message, outcome.ok ? "success" : "error");
  row += 2;
  writeLine(row, ` ${c.dim("Press any key to continue...")}`);
  yield* readKey;
  return "back" as ViewResult;
});

// ── Main Menu ───────────────────────────────────────────────────────

const mainMenuItems = [
  {
    hint: "Browse & manage contexts",
    icon: icons.folder,
    key: "contexts",
    label: "Contexts",
  },
  {
    hint: "View secrets in current context",
    icon: icons.key,
    key: "secrets",
    label: "Secrets",
  },
  {
    hint: "Store a new secret",
    icon: icons.save,
    key: "add",
    label: "Add Secret",
  },
  {
    hint: "Search secrets or contexts",
    icon: icons.search,
    key: "search",
    label: "Search",
  },
  {
    hint: "Manage saved commands",
    icon: icons.bolt,
    key: "commands",
    label: "Saved Commands",
  },
  {
    hint: "Check expiring secrets",
    icon: icons.chart,
    key: "audit",
    label: "Audit",
  },
  {
    hint: "Load secrets from .env file",
    icon: icons.upload,
    key: "import",
    label: "Import .env",
  },
  {
    hint: "Export secrets to .env file",
    icon: icons.download,
    key: "export",
    label: "Export .env",
  },
];

export const mainMenuView = Effect.fn("tui.mainMenuView")(
  // oxlint-disable-next-line complexity -- interactive TUI loop with menu routing
  function* mainMenuView(initialContext: string | null) {
    let ctx = initialContext;
    let selected = 0;
    let message: {
      text: string;
      type: "success" | "error" | "info" | "warning";
    } | null = null;

    const render = () => {
      write(screen.clear);
      let row = renderHeader(ctx, "Main Menu");
      row += 1;
      row = renderMenu(mainMenuItems, selected, row);
      row += 1;
      if (message) {
        renderMessage(row, message.text, message.type);
        row += 1;
      }
      renderFooter([
        "↑↓ navigate",
        "Enter select",
        "c change context",
        "q quit",
      ]);
    };

    let running = true;
    while (running) {
      render();
      const key = yield* readKey;

      message = null;

      if (key.name === "q" || (key.ctrl && key.name === "c")) {
        running = false;
        continue;
      }

      if (key.name === "up") {
        selected = (selected - 1 + mainMenuItems.length) % mainMenuItems.length;
      } else if (key.name === "down") {
        selected = (selected + 1) % mainMenuItems.length;
      } else if (key.name === "c") {
        const result = yield* contextsView();
        if (result === "quit") {
          running = false;
        } else if (result === "clearContext") {
          ctx = null;
          message = { text: "Context cleared", type: "info" };
        } else if (typeof result === "object" && "setContext" in result) {
          ctx = result.setContext;
          message = {
            text: `Context set to "${result.setContext}"`,
            type: "success",
          };
        }
      } else if (key.name === "return") {
        const item = mainMenuItems[selected];
        if (!item) {
          continue;
        }

        switch (item.key) {
          case "contexts": {
            const result = yield* contextsView();
            if (result === "quit") {
              running = false;
            } else if (result === "clearContext") {
              ctx = null;
              message = { text: "Context cleared", type: "info" };
            } else if (typeof result === "object" && "setContext" in result) {
              ctx = result.setContext;
              message = {
                text: `Context set to "${result.setContext}"`,
                type: "success",
              };
            }
            break;
          }
          case "secrets": {
            let secretsCtx = ctx;
            if (!secretsCtx) {
              const picked = yield* selectContext("Secrets — Select Context");
              if (!picked) {
                break;
              }
              secretsCtx = picked;
            }
            const result = yield* secretsView(secretsCtx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "add": {
            let addCtx = ctx;
            if (!addCtx) {
              const picked = yield* selectContext(
                "Add Secret — Select Context"
              );
              if (!picked) {
                break;
              }
              addCtx = picked;
            }
            const result = yield* addSecretView(addCtx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "search": {
            const result = yield* searchView(ctx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "commands": {
            const result = yield* commandsView();
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "audit": {
            const result = yield* auditView(ctx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "import": {
            let importCtx = ctx;
            if (!importCtx) {
              const picked = yield* selectContext("Import — Select Context");
              if (!picked) {
                break;
              }
              importCtx = picked;
            }
            const result = yield* importView(importCtx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "export": {
            let exportCtx = ctx;
            if (!exportCtx) {
              const picked = yield* selectContext("Export — Select Context");
              if (!picked) {
                break;
              }
              exportCtx = picked;
            }
            const result = yield* exportView(exportCtx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          default: {
            break;
          }
        }
      }
    }
  }
);
