/**
 * TUI views — each view is a self-contained interactive screen.
 * All views consume SecretStore via Effect dependency injection.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Effect } from "effect";
import { expiresAtFromNow, parseDuration } from "../domain/duration.js";
import type { SecretMetadata } from "../services/metadata-store.js";
import { SecretStore } from "../services/secret-store.js";
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

// ── Main Menu ───────────────────────────────────────────────────────

const mainMenuItems = [
  {
    key: "contexts",
    label: "Contexts",
    icon: "📁",
    hint: "Browse & manage contexts",
  },
  {
    key: "secrets",
    label: "Secrets",
    icon: "🔑",
    hint: "View secrets in current context",
  },
  { key: "add", label: "Add Secret", icon: "➕", hint: "Store a new secret" },
  {
    key: "search",
    label: "Search",
    icon: "🔍",
    hint: "Search secrets or contexts",
  },
  {
    key: "commands",
    label: "Saved Commands",
    icon: "⚡",
    hint: "Manage saved commands",
  },
  { key: "audit", label: "Audit", icon: "📊", hint: "Check expiring secrets" },
  {
    key: "import",
    label: "Import .env",
    icon: "⬆",
    hint: "Load secrets from .env file",
  },
  {
    key: "export",
    label: "Export .env",
    icon: "⬇",
    hint: "Export secrets to .env file",
  },
];

export const mainMenuView = (
  initialContext: string | null
): Effect.Effect<void, never, SecretStore> =>
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: interactive TUI loop with menu routing
  Effect.gen(function* () {
    let ctx = initialContext;
    let selected = 0;
    let message: {
      text: string;
      type: "success" | "error" | "info" | "warning";
    } | null = null;

    const render = () => {
      write(screen.clear);
      let row = renderHeader(ctx, "Main Menu");
      row++;
      row = renderMenu(mainMenuItems, selected, row);
      row++;
      if (message) {
        renderMessage(row, message.text, message.type);
        row++;
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
        const newCtx = yield* promptContext();
        if (newCtx !== null) {
          ctx = newCtx;
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
            }
            break;
          }
          case "secrets": {
            if (!ctx) {
              message = {
                text: "Set a context first (press c)",
                type: "warning",
              };
              break;
            }
            const result = yield* secretsView(ctx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "add": {
            if (!ctx) {
              message = {
                text: "Set a context first (press c)",
                type: "warning",
              };
              break;
            }
            const result = yield* addSecretView(ctx);
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
            if (!ctx) {
              message = {
                text: "Set a context first (press c)",
                type: "warning",
              };
              break;
            }
            const result = yield* importView(ctx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          case "export": {
            if (!ctx) {
              message = {
                text: "Set a context first (press c)",
                type: "warning",
              };
              break;
            }
            const result = yield* exportView(ctx);
            if (result === "quit") {
              running = false;
            }
            break;
          }
          default:
            break;
        }
      }
    }
  });

// ── Prompt Context ──────────────────────────────────────────────────

const promptContext = (): Effect.Effect<string | null, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    renderHeader(null, "Set Context");

    // Show existing contexts as hints
    const contexts = yield* SecretStore.listContexts().pipe(
      Effect.catchAll(() => Effect.succeed([]))
    );

    let row = 4;
    if (contexts.length > 0) {
      writeLine(row, ` ${c.dim("Existing contexts:")}`);
      row++;
      for (const ctx of contexts.slice(0, 10)) {
        writeLine(
          row,
          `   ${c.dim("•")} ${ctx.context} ${c.dim(`(${ctx.count} secrets)`)}`
        );
        row++;
      }
      row++;
    }

    write(cursor.show);
    const input = yield* readLine(` ${c.cyan("Context name:")} `);
    write(cursor.hide);

    if (input === null || input.trim() === "") {
      return null;
    }
    return input.trim();
  });

// ── Contexts View ───────────────────────────────────────────────────

const contextsView = (): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    let selected = 0;

    const loop = (): Effect.Effect<ViewResult, never, SecretStore> =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: interactive TUI loop
      Effect.gen(function* () {
        const contexts = yield* SecretStore.listContexts().pipe(
          Effect.catchAll(() => Effect.succeed([]))
        );

        write(screen.clear);
        let row = renderHeader(null, "Contexts");
        row++;

        if (contexts.length === 0) {
          row = renderEmpty(
            row,
            "No contexts found. Add secrets to create one."
          );
          renderFooter(["Esc back", "q quit"]);
          const key = yield* readKey;
          if (key.name === "q" || (key.ctrl && key.name === "c")) {
            return "quit" as ViewResult;
          }
          return "back" as ViewResult;
        }

        const items = contexts.map((ctx) => ({
          key: ctx.context,
          label: ctx.context,
          icon: "📁",
          hint: `${ctx.count} secrets`,
        }));

        selected = Math.min(selected, items.length - 1);
        row = renderMenu(items, selected, row);
        row++;
        renderFooter([
          "↑↓ navigate",
          "Enter view secrets",
          "d delete all",
          "Esc back",
          "q quit",
        ]);

        const key = yield* readKey;

        if (key.name === "q" || (key.ctrl && key.name === "c")) {
          return "quit" as ViewResult;
        }
        if (key.name === "escape") {
          return "back" as ViewResult;
        }
        if (key.name === "up") {
          selected = (selected - 1 + items.length) % items.length;
        }
        if (key.name === "down") {
          selected = (selected + 1) % items.length;
        }

        if (key.name === "return") {
          const ctx = contexts[selected];
          if (ctx) {
            const result = yield* secretsView(ctx.context);
            if (result === "quit") {
              return "quit" as ViewResult;
            }
          }
        }

        if (key.name === "d") {
          const ctx = contexts[selected];
          if (ctx) {
            yield* confirmDeleteContext(ctx.context);
          }
        }

        return yield* loop();
      });

    return yield* loop();
  });

// ── Confirm delete context ──────────────────────────────────────────

const confirmDeleteContext = (
  context: string
): Effect.Effect<boolean, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    renderHeader(context, "Delete All Secrets");
    writeLine(
      5,
      ` ${c.red("⚠")} ${c.bold("Delete ALL secrets")} in context ${c.bold(c.cyan(`"${context}"`))}?`
    );
    writeLine(7, ` ${c.dim("This cannot be undone.")}`);
    writeLine(
      9,
      ` ${c.green("y")} confirm  ${c.dim("/")}  ${c.red("n")} cancel`
    );

    const key = yield* readKey;
    if (key.name === "y") {
      const secrets = yield* SecretStore.list(context).pipe(
        Effect.catchAll(() => Effect.succeed([]))
      );
      yield* SecretStore.beginBatch().pipe(Effect.catchAll(() => Effect.void));
      for (const s of secrets) {
        yield* SecretStore.remove(context, s.key).pipe(
          Effect.catchAll(() => Effect.void)
        );
      }
      yield* SecretStore.endBatch().pipe(Effect.catchAll(() => Effect.void));
      return true;
    }
    return false;
  });

// ── Secrets View ────────────────────────────────────────────────────

const secretsView = (
  context: string
): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    let selected = 0;
    let message: {
      text: string;
      type: "success" | "error" | "info" | "warning";
    } | null = null;

    const loop = (): Effect.Effect<ViewResult, never, SecretStore> =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: interactive TUI loop
      Effect.gen(function* () {
        const secrets = yield* SecretStore.list(context).pipe(
          Effect.catchAll(() => Effect.succeed([] as SecretMetadata[]))
        );

        write(screen.clear);
        let row = renderHeader(context, "Secrets");
        row++;

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
            return yield* loop();
          }
          return yield* loop();
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
        row++;

        if (message) {
          renderMessage(row, message.text, message.type);
          row++;
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

        return yield* loop();
      });

    return yield* loop();
  });

// ── Reveal Secret View ──────────────────────────────────────────────

const revealSecretView = (
  context: string,
  key: string
): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    let row = renderHeader(context, "Secret Detail");
    row++;

    const meta = yield* SecretStore.getMetadata(context, key).pipe(
      Effect.catchAll(() => Effect.succeed(null))
    );

    writeLine(row, ` ${c.bold("Key:")}     ${c.cyan(key)}`);
    row++;

    if (meta) {
      writeLine(row, ` ${c.bold("Created:")} ${c.dim(meta.created_at)}`);
      row++;
      writeLine(row, ` ${c.bold("Updated:")} ${c.dim(meta.updated_at)}`);
      row++;
      writeLine(
        row,
        ` ${c.bold("Expires:")} ${meta.expires_at ? c.yellow(meta.expires_at) : c.dim("never")}`
      );
      row++;
    }

    row++;
    writeLine(row, ` ${c.dim("Press 'r' to reveal value, Esc to go back")}`);

    renderFooter(["r reveal value", "Esc back", "q quit"]);

    const loop = (): Effect.Effect<ViewResult, never, SecretStore> =>
      Effect.gen(function* () {
        const k = yield* readKey;
        if (k.name === "q" || (k.ctrl && k.name === "c")) {
          return "quit" as ViewResult;
        }
        if (k.name === "escape") {
          return "back" as ViewResult;
        }

        if (k.name === "r") {
          const value = yield* SecretStore.get(context, key).pipe(
            Effect.catchAll((e) => Effect.succeed(`[error: ${e._tag}]`))
          );
          row++;
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

        return yield* loop();
      });

    return yield* loop();
  });

// ── Confirm Delete ──────────────────────────────────────────────────

const confirmDelete = (
  context: string,
  key: string
): Effect.Effect<boolean, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    renderHeader(context, "Delete Secret");
    writeLine(5, ` ${c.red("⚠")} Delete secret ${c.bold(c.cyan(`"${key}"`))}?`);
    writeLine(
      7,
      ` ${c.green("y")} confirm  ${c.dim("/")}  ${c.red("n")} cancel`
    );

    const k = yield* readKey;
    if (k.name === "y") {
      yield* SecretStore.remove(context, key).pipe(
        Effect.catchAll(() => Effect.void)
      );
      return true;
    }
    return false;
  });

// ── Add Secret View ─────────────────────────────────────────────────

const addSecretView = (
  context: string
): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    let row = renderHeader(context, "Add Secret");
    row++;

    write(cursor.show);

    writeLine(row, "");
    row++;
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

    let expiresAt: string | null = null;
    if (expiresInput && expiresInput.trim() !== "") {
      const duration = yield* parseDuration(expiresInput.trim()).pipe(
        Effect.catchAll(() => Effect.succeed(null))
      );
      if (duration) {
        expiresAt = expiresAtFromNow(duration);
      }
    }

    yield* SecretStore.set(context, key.trim(), value, expiresAt).pipe(
      Effect.catchAll((e) => {
        renderMessage(row + 2, `Error: ${e.message}`, "error");
        return Effect.void;
      })
    );

    row += 2;
    renderMessage(row, `Secret "${key.trim()}" stored`, "success");
    row++;
    writeLine(row, ` ${c.dim("Press any key to continue...")}`);
    yield* readKey;

    return "back" as ViewResult;
  });

// ── Search View ─────────────────────────────────────────────────────

const searchView = (
  context: string | null
): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    let row = renderHeader(context, "Search");
    row++;

    write(cursor.show);
    const pattern = yield* readLine(` ${c.cyan("Pattern (glob):")} `);
    write(cursor.hide);

    if (pattern === null || pattern.trim() === "") {
      return "back" as ViewResult;
    }

    row += 2;

    if (context) {
      const results = yield* SecretStore.search(context, pattern.trim()).pipe(
        Effect.catchAll(() => Effect.succeed([]))
      );

      if (results.length === 0) {
        renderMessage(row, "No secrets found.", "info");
      } else {
        writeLine(row, ` ${c.bold(`${results.length} results:`)}`);
        row++;
        for (const r of results.slice(0, 20)) {
          writeLine(row, `   ${c.yellow("🔑")} ${r.key}`);
          row++;
        }
      }
    } else {
      const results = yield* SecretStore.searchContexts(pattern.trim()).pipe(
        Effect.catchAll(() => Effect.succeed([]))
      );

      if (results.length === 0) {
        renderMessage(row, "No contexts found.", "info");
      } else {
        writeLine(row, ` ${c.bold(`${results.length} contexts:`)}`);
        row++;
        for (const r of results.slice(0, 20)) {
          writeLine(
            row,
            `   ${c.blue("📁")} ${r.context} ${c.dim(`(${r.count} secrets)`)}`
          );
          row++;
        }
      }
    }

    row += 2;
    writeLine(row, ` ${c.dim("Press any key to continue...")}`);
    yield* readKey;
    return "back" as ViewResult;
  });

// ── Commands View ───────────────────────────────────────────────────

const commandsView = (): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    let selected = 0;

    const loop = (): Effect.Effect<ViewResult, never, SecretStore> =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: interactive TUI loop
      Effect.gen(function* () {
        const commands = yield* SecretStore.listCommands().pipe(
          Effect.catchAll(() => Effect.succeed([]))
        );

        write(screen.clear);
        let row = renderHeader(null, "Saved Commands");
        row++;

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
          cmd.command.length > 30
            ? `${cmd.command.slice(0, 27)}...`
            : cmd.command,
          cmd.context,
        ]);

        row = renderTable(columns, tableRows, selected, row);
        row++;
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
              Effect.catchAll(() => Effect.void)
            );
          }
        }

        return yield* loop();
      });

    return yield* loop();
  });

// ── Audit View ──────────────────────────────────────────────────────

const auditView = (
  context: string | null
): Effect.Effect<ViewResult, never, SecretStore> =>
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: interactive TUI view
  Effect.gen(function* () {
    write(screen.clear);
    let row = renderHeader(context, "Audit — Expiring Secrets");
    row++;

    const windowMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();

    if (context) {
      const secrets = yield* SecretStore.listExpiring(context, windowMs).pipe(
        Effect.catchAll(() => Effect.succeed([]))
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
          const icon = expired ? c.red("⏰") : c.yellow("🕐");
          const status = expired ? c.red("EXPIRED") : c.yellow("expiring");
          writeLine(
            row,
            `   ${icon} ${s.key}  ${status}  ${c.dim(s.expires_at ?? "")}`
          );
          row++;
        }
      }
    } else {
      const secrets = yield* SecretStore.listAllExpiring(windowMs).pipe(
        Effect.catchAll(() => Effect.succeed([]))
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
          const icon = expired ? c.red("⏰") : c.yellow("🕐");
          const status = expired ? c.red("EXPIRED") : c.yellow("expiring");
          writeLine(
            row,
            `   ${icon} ${c.dim(`[${s.env}]`)} ${s.key}  ${status}  ${c.dim(s.expires_at ?? "")}`
          );
          row++;
        }
      }
    }

    row += 2;
    writeLine(row, ` ${c.dim("Press any key to continue...")}`);
    renderFooter(["any key to go back"]);
    yield* readKey;
    return "back" as ViewResult;
  });

// ── Import View ─────────────────────────────────────────────────────

const importView = (
  context: string
): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    let row = renderHeader(context, "Import .env File");
    row++;

    write(cursor.show);
    const filePath = yield* readLine(
      ` ${c.cyan("File path (default: .env):")} `
    );
    write(cursor.hide);

    const path = filePath && filePath.trim() !== "" ? filePath.trim() : ".env";

    row += 2;
    writeLine(row, ` ${c.dim("Reading")} ${path}${c.dim("...")}`);

    const content = yield* Effect.try({
      try: () => readFileSync(path, "utf-8"),
      catch: () => new Error(`Cannot read file: ${path}`),
    }).pipe(
      Effect.catchAll((e) => {
        renderMessage(row + 1, String(e), "error");
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

    yield* SecretStore.beginBatch().pipe(Effect.catchAll(() => Effect.void));

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
        .replace(/^["']|["']$/g, "");
      const secretKey = key.toLowerCase().replaceAll("_", ".");
      yield* SecretStore.set(context, secretKey, value).pipe(
        Effect.catchAll(() => Effect.void)
      );
      added++;
    }

    yield* SecretStore.endBatch().pipe(Effect.catchAll(() => Effect.void));

    row++;
    renderMessage(row, `Imported ${added} secrets from ${path}`, "success");
    row += 2;
    writeLine(row, ` ${c.dim("Press any key to continue...")}`);
    yield* readKey;
    return "back" as ViewResult;
  });

// ── Export View ─────────────────────────────────────────────────────

const exportView = (
  context: string
): Effect.Effect<ViewResult, never, SecretStore> =>
  Effect.gen(function* () {
    write(screen.clear);
    let row = renderHeader(context, "Export .env File");
    row++;

    write(cursor.show);
    const filePath = yield* readLine(
      ` ${c.cyan("Output path (default: .env):")} `
    );
    write(cursor.hide);

    const path = filePath && filePath.trim() !== "" ? filePath.trim() : ".env";

    row += 2;
    writeLine(row, ` ${c.dim("Exporting secrets...")}`);

    const secrets = yield* SecretStore.list(context).pipe(
      Effect.catchAll(() => Effect.succeed([] as SecretMetadata[]))
    );

    if (secrets.length === 0) {
      row++;
      renderMessage(row, "No secrets to export.", "info");
      row += 2;
      writeLine(row, ` ${c.dim("Press any key to continue...")}`);
      yield* readKey;
      return "back" as ViewResult;
    }

    const lines: string[] = [];
    for (const item of secrets) {
      const value = yield* SecretStore.get(context, item.key).pipe(
        Effect.catchAll(() => Effect.succeed(""))
      );
      const envKey = item.key.toUpperCase().replaceAll(".", "_");
      const escaped = String(value)
        .replaceAll("\\", "\\\\")
        .replaceAll('"', '\\"')
        .replaceAll("\n", "\\n");
      lines.push(`${envKey}="${escaped}"`);
    }

    yield* Effect.try({
      try: () => writeFileSync(path, `${lines.join("\n")}\n`, "utf-8"),
      catch: () => new Error(`Failed to write: ${path}`),
    }).pipe(
      Effect.catchAll((e) => {
        renderMessage(row + 1, String(e), "error");
        return Effect.void;
      })
    );

    row++;
    renderMessage(
      row,
      `Exported ${lines.length} secrets to ${path}`,
      "success"
    );
    row += 2;
    writeLine(row, ` ${c.dim("Press any key to continue...")}`);
    yield* readKey;
    return "back" as ViewResult;
  });
