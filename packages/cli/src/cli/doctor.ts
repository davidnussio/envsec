import { execFile } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { platform, release } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  badge,
  bold,
  dim,
  green,
  icons,
  indent,
  red,
  SecretStore,
  yellow,
} from "@envsec/core";
import { Console, Effect } from "effect";
import { Command } from "effect/cli";

import { effectVersion, envsecVersion } from "../build-info.js";
import { resolveDbPath } from "../db-path.js";
import { isJsonOutput } from "./root.js";

interface CheckResult {
  readonly detail?: string;
  readonly message: string;
  readonly name: string;
  readonly ok: boolean;
}

const pass = (name: string, message: string, detail?: string): CheckResult => ({
  detail,
  message,
  name,
  ok: true,
});

const fail = (name: string, message: string, detail?: string): CheckResult => ({
  detail,
  message,
  name,
  ok: false,
});

const execFileAsync = promisify(execFile);

const ignoreStreamError = (): void => undefined;

/** A probe that hangs (e.g. a keyring unlock prompt) must not hang doctor. */
const EXEC_TIMEOUT_MS = 10_000;

/**
 * Run a command and return stdout/stderr/exitCode. Never rejects.
 * `stdin` is written to the child and stdin is always closed: tools such as
 * `secret-tool store` read until EOF and would otherwise wait forever.
 */
const exec = async (
  cmd: string,
  args: string[],
  stdin = ""
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> => {
  const running = execFileAsync(cmd, args, { timeout: EXEC_TIMEOUT_MS });
  // A child that exits without reading stdin raises EPIPE here; its exit
  // status already reports the failure, so the stream error is ignored.
  running.child.stdin?.on("error", ignoreStreamError);
  running.child.stdin?.end(stdin);
  try {
    const { stdout, stderr } = await running;
    return { exitCode: 0, stderr, stdout };
  } catch (error) {
    // The rejection carries the same error the callback API would receive,
    // plus the captured stdout/stderr.
    const failure = error as {
      code?: unknown;
      stderr?: string;
      stdout?: string;
    };
    if (failure.code === "ENOENT") {
      return { exitCode: -1, stderr: "not found", stdout: "" };
    }
    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      stderr: failure.stderr ?? "",
      stdout: failure.stdout ?? "",
    };
  }
};

// ── Individual checks ───────────────────────────────────────────────

const checkPlatform = (): CheckResult => {
  const os = platform();
  const ver = release();
  const supported = ["darwin", "linux", "win32"];
  if (supported.includes(os)) {
    return pass("Platform", `${os} ${ver}`, "Supported platform");
  }
  return fail("Platform", `${os} ${ver}`, "Unsupported platform");
};

/** node:sqlite runs without a flag from Node 22.13. */
const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 13;

const checkRuntime = (): CheckResult => {
  const bunVersion = process.versions.bun;
  if (bunVersion !== undefined) {
    return pass("Bun", bunVersion);
  }
  const ver = process.version;
  const [major = 0, minor = 0] = ver.slice(1).split(".").map(Number);
  if (
    major > MIN_NODE_MAJOR ||
    (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR)
  ) {
    return pass("Node.js", ver);
  }
  return fail(
    "Node.js",
    ver,
    `Node.js >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR} required`
  );
};

const checkCredentialStore = async (): Promise<CheckResult> => {
  const os = platform();
  switch (os) {
    case "darwin": {
      const r = await exec("security", ["list-keychains"]);
      if (r.exitCode === 0) {
        return pass(
          "Credential store",
          "macOS Keychain",
          "security CLI available"
        );
      }
      return fail(
        "Credential store",
        "macOS Keychain unavailable",
        r.stderr.trim()
      );
    }
    case "linux": {
      const r = await exec("secret-tool", ["--version"]);
      if (r.exitCode !== -1) {
        return pass(
          "Credential store",
          "Secret Service (libsecret)",
          "secret-tool available"
        );
      }
      return fail(
        "Credential store",
        "secret-tool not found",
        "Install libsecret-tools (apt install libsecret-tools)"
      );
    }
    case "win32": {
      // The adapter calls CredWriteW/CredReadW/CredDeleteW through
      // PowerShell's Add-Type (P/Invoke), not cmdkey.
      const r = await exec("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-Command Add-Type | Out-Null; echo ok",
      ]);
      if (r.stdout.trim() === "ok") {
        return pass(
          "Credential store",
          "Windows Credential Manager",
          "PowerShell + Add-Type (P/Invoke) available"
        );
      }
      return fail(
        "Credential store",
        "Credential Manager unavailable",
        r.stderr.trim()
      );
    }
    default: {
      return fail("Credential store", `Unsupported platform: ${os}`);
    }
  }
};

const checkKeychainReadWrite = async (): Promise<CheckResult> => {
  const testService = "envsec.doctor.test";
  const testAccount = "probe";
  const testValue = "doctor-probe";
  const os = platform();

  try {
    if (os === "darwin") {
      const setR = await exec("security", [
        "add-generic-password",
        "-U",
        "-s",
        testService,
        "-a",
        testAccount,
        "-w",
        testValue,
      ]);
      if (setR.exitCode !== 0) {
        return fail("Keychain read/write", "Write failed", setR.stderr.trim());
      }
      const getR = await exec("security", [
        "find-generic-password",
        "-s",
        testService,
        "-a",
        testAccount,
        "-w",
      ]);
      if (getR.exitCode !== 0 || getR.stdout.trim() !== testValue) {
        return fail("Keychain read/write", "Read-back mismatch");
      }
      await exec("security", [
        "delete-generic-password",
        "-s",
        testService,
        "-a",
        testAccount,
      ]);
      return pass("Keychain read/write", "Write/read/delete OK");
    }

    if (os === "linux") {
      const attributes = ["service", testService, "account", testAccount];
      // secret-tool store reads the secret from stdin until EOF.
      const setR = await exec(
        "secret-tool",
        ["store", "--label", "envsec doctor probe", ...attributes],
        testValue
      );
      if (setR.exitCode === -1) {
        return fail("Keychain read/write", "secret-tool not found");
      }
      if (setR.exitCode !== 0) {
        return fail("Keychain read/write", "Write failed", setR.stderr.trim());
      }
      const getR = await exec("secret-tool", ["lookup", ...attributes]);
      await exec("secret-tool", ["clear", ...attributes]);
      if (getR.exitCode !== 0 || getR.stdout.trim() !== testValue) {
        return fail("Keychain read/write", "Read-back mismatch");
      }
      return pass("Keychain read/write", "Write/read/delete OK");
    }

    if (os === "win32") {
      return pass(
        "Keychain read/write",
        "Skipped on Windows",
        "Credential Manager availability checked via PowerShell"
      );
    }

    return fail("Keychain read/write", `Unsupported platform: ${os}`);
  } catch (error) {
    return fail("Keychain read/write", `Unexpected error: ${error}`);
  }
};

const checkDatabase = (dbPath: string): CheckResult => {
  const dir = path.dirname(dbPath);

  if (!existsSync(dir)) {
    return fail(
      "Database directory",
      `${dir} does not exist`,
      "It will be created on first use"
    );
  }

  try {
    accessSync(dir, constants.W_OK);
  } catch {
    return fail("Database directory", `${dir} is not writable`);
  }

  if (!existsSync(dbPath)) {
    return pass(
      "Database",
      "Not yet created",
      `Will be initialized at ${dbPath}`
    );
  }

  try {
    const stat = statSync(dbPath);
    // oxlint-disable-next-line no-bitwise -- extracting Unix permission bits
    const mode = `0o${(stat.mode & 0o777).toString(8)}`;
    return pass("Database", dbPath, `Permissions: ${mode}`);
  } catch (error) {
    return fail("Database", `Cannot stat ${dbPath}: ${error}`);
  }
};

const checkDatabaseIntegrity = Effect.fn("checkDatabaseIntegrity")(
  function* checkDatabaseIntegrity(dbPath: string) {
    if (!existsSync(dbPath)) {
      return pass("Database integrity", "Skipped (no database file yet)");
    }
    // If we can list contexts, the DB schema is valid and readable
    const contexts = yield* SecretStore.listContexts().pipe(
      Effect.catch(() => Effect.succeed(null))
    );
    if (contexts === null) {
      return fail(
        "Database integrity",
        "Failed to query database",
        "Database may be corrupted"
      );
    }
    return pass(
      "Database integrity",
      "Schema OK",
      `${contexts.length} context(s) found`
    );
  }
);

const checkOrphanedSecrets = Effect.fn("checkOrphanedSecrets")(
  function* checkOrphanedSecrets(dbPath: string) {
    if (!existsSync(dbPath)) {
      return pass("Orphaned secrets", "Skipped (no database file yet)");
    }
    const contexts = yield* SecretStore.listContexts().pipe(
      Effect.catch(() =>
        Effect.succeed([] as { context: string; count: number }[])
      )
    );
    let orphanCount = 0;
    for (const ctx of contexts) {
      const secrets = yield* SecretStore.list(ctx.context).pipe(
        Effect.catch(() =>
          Effect.succeed(
            [] as {
              key: string;
              updated_at: string;
              expires_at: string | null;
            }[]
          )
        )
      );
      for (const s of secrets) {
        const result = yield* SecretStore.get(ctx.context, s.key).pipe(
          Effect.map(() => true),
          Effect.catch(() => Effect.succeed(false))
        );
        if (!result) {
          orphanCount += 1;
        }
      }
    }
    if (orphanCount > 0) {
      return fail(
        "Orphaned secrets",
        `${orphanCount} secret(s) in metadata but missing from keychain`,
        "Run envsec list and envsec delete to clean up"
      );
    }
    return pass("Orphaned secrets", "None found");
  }
);

const checkExpiredSecrets = Effect.fn("checkExpiredSecrets")(
  function* checkExpiredSecrets(dbPath: string) {
    if (!existsSync(dbPath)) {
      return pass("Expired secrets", "Skipped (no database file yet)");
    }
    const expired = yield* SecretStore.listAllExpiring(0).pipe(
      Effect.catch(() => Effect.succeed([]))
    );
    if (expired.length > 0) {
      return fail(
        "Expired secrets",
        `${expired.length} expired secret(s)`,
        "Run envsec audit --within 0d for details"
      );
    }
    return pass("Expired secrets", "None");
  }
);

const checkEnvConfig = (): CheckResult => {
  const envDb = process.env.ENVSEC_DB;
  const envCtx = process.env.ENVSEC_CONTEXT;
  const parts: string[] = [];

  if (envDb) {
    parts.push(`ENVSEC_DB=${envDb}`);
    if (!existsSync(path.dirname(envDb))) {
      return fail(
        "Environment",
        `ENVSEC_DB directory does not exist: ${path.dirname(envDb)}`
      );
    }
  }
  if (envCtx) {
    parts.push(`ENVSEC_CONTEXT=${envCtx}`);
  }

  if (parts.length === 0) {
    return pass("Environment", "No env vars set", "Using defaults");
  }
  return pass("Environment", parts.join(", "));
};

const checkShell = (): CheckResult => {
  const shell = process.env.SHELL ?? process.env.ComSpec ?? "unknown";
  return pass("Shell", shell);
};

// ── Output formatting ───────────────────────────────────────────────

const formatCheck = (r: CheckResult): string => {
  const icon = r.ok ? icons.success : icons.error;
  const detail = r.detail ? `  ${dim(r.detail)}` : "";
  return indent(`${icon} ${bold(r.name)}: ${r.message}${detail}`);
};

// ── Command ─────────────────────────────────────────────────────────

export const doctorCommand = Command.make("doctor", {}, () =>
  Effect.gen(function* doctorHandler() {
    const jsonMode = yield* isJsonOutput;
    const dbPath = resolveDbPath();

    // Sync checks
    const results: CheckResult[] = [
      pass("Version", envsecVersion),
      pass("Effect", effectVersion),
      checkPlatform(),
      checkRuntime(),
      checkShell(),
      checkEnvConfig(),
    ];

    // Async checks (credential store)
    const credStore = yield* Effect.tryPromise({
      catch: (e) => fail("Credential store", `Check failed: ${e}`),
      try: () => checkCredentialStore(),
    }).pipe(Effect.catch((error) => Effect.succeed(error)));

    const credRW = yield* Effect.tryPromise({
      catch: (e) => fail("Keychain read/write", `Check failed: ${e}`),
      try: () => checkKeychainReadWrite(),
    }).pipe(Effect.catch((error) => Effect.succeed(error)));

    // Database checks
    const database = checkDatabase(dbPath);
    const integrity = yield* checkDatabaseIntegrity(dbPath);
    const orphans = yield* checkOrphanedSecrets(dbPath);
    const expired = yield* checkExpiredSecrets(dbPath);

    results.push(credStore, credRW, database, integrity, orphans, expired);

    // Output
    if (jsonMode) {
      yield* Console.log(
        JSON.stringify(
          // oxlint-disable-next-line sort-keys -- key order is part of the --json output
          results.map((r) => ({
            name: r.name,
            ok: r.ok,
            message: r.message,
            ...(r.detail ? { detail: r.detail } : {}),
          }))
        )
      );
      return;
    }

    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    yield* Console.log(`\n${icons.shield} envsec doctor\n`);
    for (const r of results) {
      yield* Console.log(formatCheck(r));
    }
    yield* Console.log("");

    yield* Console.log(
      indent(
        failed === 0
          ? `${icons.success} All ${badge(passed, "check")} passed — everything looks good`
          : `${icons.warning} ${green(String(passed))} passed, ${red(String(failed))} ${yellow("failed")} — see above for details`
      )
    );
    yield* Console.log("");
  })
).pipe(Command.withDescription("Diagnose your envsec setup"));
