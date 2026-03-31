import { DatabaseConfigDefault, SecretStore } from "@envsec/core";
import { Effect, Layer, ManagedRuntime } from "effect";
import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import type { Context, EnvsecRPC, Secret } from "../shared/types";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// ── Effect runtime ──────────────────────────────────────────────────
const storeLayer = SecretStore.Default.pipe(
  Layer.provide(DatabaseConfigDefault)
);
const runtime = ManagedRuntime.make(storeLayer);

/** Run an Effect program against the SecretStore runtime. */
function run<A>(effect: Effect.Effect<A, unknown, SecretStore>) {
  return runtime.runPromise(effect.pipe(Effect.catchAll((e) => Effect.die(e))));
}

// 30 days in ms — used for audit "expiring soon" window
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ── RPC handlers ────────────────────────────────────────────────────
const rpc = BrowserView.defineRPC<EnvsecRPC>({
  maxRequestTime: 15_000,
  handlers: {
    requests: {
      listContexts: async () => {
        try {
          const rows = await run(SecretStore.listContexts());
          return rows.map(
            (r): Context => ({ name: r.context, count: r.count })
          );
        } catch {
          return [];
        }
      },

      listSecrets: async ({ context }) => {
        try {
          const rows = await run(SecretStore.list(context));
          return rows.map(
            (r): Secret => ({
              key: r.key,
              service: "",
              account: "",
              updatedAt: r.updated_at,
              expiresAt: r.expires_at,
            })
          );
        } catch {
          return [];
        }
      },

      getSecret: async ({ context, key }) => {
        try {
          return await run(
            SecretStore.get(context, key).pipe(
              Effect.catchTag("SecretNotFoundError", () => Effect.succeed(""))
            )
          );
        } catch {
          return "";
        }
      },

      addSecret: async ({ context, key, value, expires }) => {
        try {
          await run(SecretStore.set(context, key, value, expires ?? undefined));
          return { ok: true };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : "Failed to add secret",
          };
        }
      },

      deleteSecret: async ({ context, key }) => {
        try {
          await run(SecretStore.remove(context, key));
          return { ok: true };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : "Failed to delete secret",
          };
        }
      },

      deleteContext: async ({ context }) => {
        try {
          // Remove all secrets in the context one by one
          const rows = await run(SecretStore.list(context));
          for (const row of rows) {
            await run(SecretStore.remove(context, row.key));
          }
          return { ok: true };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : "Failed to delete context",
          };
        }
      },

      searchContexts: async ({ pattern }) => {
        try {
          const rows = await run(SecretStore.searchContexts(pattern));
          return rows.map(
            (r): Context => ({ name: r.context, count: r.count })
          );
        } catch {
          return [];
        }
      },

      auditSecrets: async () => {
        try {
          const now = Date.now();
          const allExpiring = await run(
            SecretStore.listAllExpiring(THIRTY_DAYS_MS)
          );

          const expired: {
            context: string;
            key: string;
            expiresAt: string;
          }[] = [];
          const expiring: {
            context: string;
            key: string;
            expiresAt: string;
            daysLeft: number;
          }[] = [];

          for (const item of allExpiring) {
            if (!item.expires_at) {
              continue;
            }
            const expiresMs = new Date(item.expires_at).getTime();
            const daysLeft = Math.ceil(
              (expiresMs - now) / (1000 * 60 * 60 * 24)
            );
            if (daysLeft <= 0) {
              expired.push({
                context: item.env,
                key: item.key,
                expiresAt: item.expires_at,
              });
            } else {
              expiring.push({
                context: item.env,
                key: item.key,
                expiresAt: item.expires_at,
                daysLeft,
              });
            }
          }

          return { expired, expiring };
        } catch {
          return { expired: [], expiring: [] };
        }
      },
    },
    messages: {
      log: ({ msg }) => console.log("[webview]", msg),
    },
  },
});

// ── Window ──────────────────────────────────────────────────────────
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running. Using bundled view.");
    }
  }
  return "views://mainview/index.html";
}

const url = await getMainViewUrl();

new BrowserWindow({
  title: "envsec",
  url,
  frame: {
    width: 1000,
    height: 700,
    x: 200,
    y: 100,
  },
  titleBarStyle: "hiddenInset",
  rpc,
});

console.log("envsec GUI started");
