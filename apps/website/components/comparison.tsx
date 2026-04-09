import { Check, Minus, X } from "lucide-react";

const COMPARISON_ROWS = [
  {
    feature: "Secret storage",
    envsec:
      "OS native credential store (Keychain, GNOME Keyring, Credential Manager)",
    dotenv: "Plaintext .env files on disk (dotenvx adds per-file encryption)",
    onepassword: "1Password cloud vault (AES-256 encrypted)",
  },
  {
    feature: "Encryption at rest",
    envsec: "Handled by OS — battle-tested, hardware-backed on macOS",
    dotenv: "None (dotenv) / ECIES per-file (dotenvx)",
    onepassword: "AES-256 in 1Password cloud, dual-key derivation",
  },
  {
    feature: "Secrets on disk",
    envsec: "Never — values go straight to OS credential store",
    dotenv: ".env files are plaintext by default",
    onepassword: "Never locally — fetched at runtime from cloud",
  },
  {
    feature: "Git leak risk",
    envsec: "Zero — secrets never exist as files",
    dotenv: "High — requires .gitignore discipline",
    onepassword: "Zero — secrets live in cloud vault",
  },
  {
    feature: "Offline access",
    envsec: "Full — secrets are local in OS store",
    dotenv: "Full — files are local",
    onepassword: "Requires network (cached items available offline in app)",
  },
  {
    feature: "Account / subscription",
    envsec: "None — free, open source, no signup",
    dotenv: "Free and open source",
    onepassword: "Paid — from ~$3/mo individual, ~$8/user/mo business",
  },
  {
    feature: "Multi-environment",
    envsec: "Built-in contexts (myapp.dev, myapp.prod, …)",
    dotenv: "Manual file management (.env.dev, .env.prod, …)",
    onepassword: "Vaults and items, 1Password Environments (beta)",
  },
  {
    feature: "Secret search",
    envsec: "Glob search across all contexts and keys",
    dotenv: "grep through files",
    onepassword: "op item list with --tags / --category filtering",
  },
  {
    feature: "Expiry & audit",
    envsec:
      "Set TTL on secrets, audit for expired credentials and tracked .env files",
    dotenv: "Not supported",
    onepassword: "Watchtower (in app, not CLI)",
  },
  {
    feature: "Team sharing",
    envsec: "GPG-encrypted export/import",
    dotenv: "Git-based sharing with encrypted .env (dotenvx)",
    onepassword: "Built-in vault sharing, RBAC, team provisioning, audit logs",
  },
  {
    feature: "Shell integration",
    envsec: "eval $(envsec env) — supports bash, zsh, fish, PowerShell",
    dotenv: "source .env or framework-specific loaders",
    onepassword: "op run --env-file, shell plugins with biometric auth",
  },
  {
    feature: "Command runner",
    envsec:
      "{key} placeholders + --inject env vars — secrets never in ps output or history",
    dotenv: "dotenvx run -- cmd injects from encrypted .env",
    onepassword:
      "op run -- cmd injects via secret references (op://Vault/Item/field)",
  },
  {
    feature: "Interactive shell session",
    envsec: "envsec shell — scoped subshell with auto-cleanup",
    dotenv: "Not built-in",
    onepassword: "Not built-in",
  },
  {
    feature: "Saved commands",
    envsec: "envsec cmd — save, list, search, run, delete",
    dotenv: "Not built-in",
    onepassword: "Not built-in",
  },
  {
    feature: "Move / copy / rename",
    envsec: "move, copy, rename between contexts with metadata preserved",
    dotenv: "Manual file editing",
    onepassword: "op item move between vaults, op item edit",
  },
  {
    feature: "Interactive TUI",
    envsec: "envsec tui — full-screen terminal UI for all operations",
    dotenv: "Not built-in",
    onepassword: "Not built-in (desktop app is GUI)",
  },
  {
    feature: "Health diagnostics",
    envsec: "envsec doctor — checks platform, keychain, DB integrity",
    dotenv: "Not built-in",
    onepassword: "Not built-in",
  },
  {
    feature: "Shell completions",
    envsec: "Dynamic — contexts, keys, commands for bash, zsh, fish",
    dotenv: "Not built-in",
    onepassword: "Static completions for bash, zsh, fish, PowerShell",
  },
  {
    feature: "SDK / programmatic access",
    envsec: "@envsec/sdk for Node.js / Bun",
    dotenv: "require('dotenv').config() — core use case",
    onepassword: "1Password SDKs for Node.js, Python, Go, and more",
  },
  {
    feature: "Cross-platform",
    envsec: "macOS, Linux, Windows — auto-detected backend",
    dotenv: "File-based, works everywhere but no OS integration",
    onepassword: "macOS, Linux, Windows",
  },
  {
    feature: ".env compatibility",
    envsec: "Import from and export to .env files on demand",
    dotenv: "Native format — .env files are the source of truth",
    onepassword: "op inject --out-file for config file templating",
  },
  // {
  //   feature: "CI/CD integration",
  //   envsec: "Standard CLI — works anywhere Node.js runs",
  //   dotenv: "dotenvx run in any CI pipeline",
  //   onepassword:
  //     "Service accounts, native CI/CD integrations (GitHub Actions, etc.)",
  // },
  {
    feature: "Biometric auth",
    envsec: "Inherits OS biometrics (e.g. macOS Keychain unlock)",
    dotenv: "None",
    onepassword: "Fingerprint / Touch ID via app integration and shell plugins",
  },
] as const;

type CheckValue = true | false | "partial" | "asterisk";

const CHECKLIST: readonly {
  label: string;
  envsec: CheckValue;
  dotenv: CheckValue;
  onepassword: CheckValue;
}[] = [
  {
    label: "Secrets encrypted at rest",
    envsec: true,
    dotenv: false,
    onepassword: true,
  },
  {
    label: "No plaintext files on disk",
    envsec: true,
    dotenv: false,
    onepassword: true,
  },
  {
    label: "OS-level access control",
    envsec: true,
    dotenv: false,
    onepassword: false,
  },
  {
    label: "Works offline",
    envsec: true,
    dotenv: true,
    onepassword: "partial",
  },
  {
    label: "No account or subscription",
    envsec: true,
    dotenv: true,
    onepassword: false,
  },
  {
    label: "Built-in secret rotation audit",
    envsec: true,
    dotenv: false,
    onepassword: "partial",
  },
  {
    label: "Context-based organization",
    envsec: true,
    dotenv: false,
    onepassword: true,
  },
  {
    label: "GPG-encrypted sharing",
    envsec: true,
    dotenv: false,
    onepassword: false,
  },
  { label: "Interactive TUI", envsec: true, dotenv: false, onepassword: false },
  {
    label: "Saved command templates",
    envsec: true,
    dotenv: false,
    onepassword: false,
  },
  {
    label: "Team management & RBAC",
    envsec: false,
    dotenv: false,
    onepassword: true,
  },
  {
    label: "Zero config to start",
    envsec: "asterisk",
    dotenv: true,
    onepassword: false,
  },
  {
    label: "Works with existing .env files",
    envsec: true,
    dotenv: true,
    onepassword: "partial",
  },
  {
    label: "Framework agnostic",
    envsec: true,
    dotenv: true,
    onepassword: true,
  },
  { label: "Open source", envsec: true, dotenv: true, onepassword: false },
] as const;

function CheckIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
      <Check className="h-4 w-4 text-emerald-400" />
    </span>
  );
}

function CheckAsteriskIcon() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
        <Check className="h-4 w-4 text-emerald-400" />
      </span>
      <span className="font-mono text-muted-foreground text-xs">*</span>
    </span>
  );
}

function PartialIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/10">
      <Minus className="h-4 w-4 text-yellow-400" />
    </span>
  );
}

function XIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10">
      <X className="h-4 w-4 text-red-400" />
    </span>
  );
}

function StatusIcon({ value }: { value: CheckValue }) {
  if (value === "asterisk") {
    return <CheckAsteriskIcon />;
  }
  if (value === "partial") {
    return <PartialIcon />;
  }
  return value ? <CheckIcon /> : <XIcon />;
}

export function Comparison() {
  return (
    <div className="px-4 py-32 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-20 animate-reveal text-center">
          <p className="mb-3 font-mono text-emerald-400 text-sm">Comparison</p>
          <h1 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">
            envsec vs dotenv vs 1Password CLI
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Three approaches to managing secrets. One stores them in plaintext
            files, one locks them in the cloud, and one keeps them in your OS.
          </p>
        </div>

        {/* Quick checklist */}
        <div className="mb-20 animate-reveal">
          <h2 className="mb-8 text-center font-semibold text-2xl tracking-tight">
            At a glance
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/50">
            <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 border-white/5 border-b px-4 py-3 sm:grid-cols-[1fr_100px_100px_100px] sm:gap-4 sm:px-6">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Capability
              </span>
              <span className="text-center font-mono text-emerald-400 text-xs uppercase tracking-wider">
                envsec
              </span>
              <span className="text-center font-mono text-muted-foreground text-xs uppercase tracking-wider">
                dotenv
              </span>
              <span className="text-center font-mono text-blue-400 text-xs uppercase tracking-wider">
                1Password
              </span>
            </div>
            {CHECKLIST.map((row) => (
              <div
                className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 border-white/5 border-b px-4 py-3 text-sm last:border-0 sm:grid-cols-[1fr_100px_100px_100px] sm:gap-4 sm:px-6"
                key={row.label}
              >
                <span>{row.label}</span>
                <span className="flex justify-center">
                  <StatusIcon value={row.envsec} />
                </span>
                <span className="flex justify-center">
                  <StatusIcon value={row.dotenv} />
                </span>
                <span className="flex justify-center">
                  <StatusIcon value={row.onepassword} />
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1 px-2">
            <p className="text-muted-foreground text-xs">
              * macOS and Windows only. Linux requires{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 font-mono">
                libsecret-tools
              </code>{" "}
              and an active D-Bus session.
            </p>
            <p className="text-muted-foreground text-xs">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500/10 align-text-bottom">
                <Minus className="h-3 w-3 text-yellow-400" />
              </span>{" "}
              = partial support or requires additional setup.
            </p>
            <p className="text-muted-foreground text-xs">
              envsec requires Node.js &ge; 22. dotenv supports Node.js &ge; 12.
              1Password CLI is a standalone binary.
            </p>
          </div>
        </div>

        {/* Migrate section */}
        <div className="mb-20 animate-reveal">
          <h2 className="mb-4 text-center font-semibold text-2xl tracking-tight">
            Migrate from dotenv in 60 seconds
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-center text-muted-foreground">
            Already using .env files? envsec imports them directly.
          </p>

          {/* Step 1 — Import */}
          <div className="mx-auto mb-6 max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
            <div className="flex items-center gap-2 border-white/5 border-b px-4 py-2">
              <span className="h-3 w-3 rounded-full bg-red-500/60" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <span className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 font-mono text-muted-foreground text-xs">
                terminal
              </span>
            </div>
            <div className="space-y-1 p-4 font-mono text-sm">
              <p className="text-zinc-500"># Import your existing .env file</p>
              <p>
                <span className="text-emerald-400">$</span>{" "}
                <span className="text-zinc-200">envsec -c myapp.dev load</span>
              </p>
              <p className="text-zinc-500">
                ✔ Done: 12 added, 0 overwritten, 0 skipped
              </p>
              <p className="mt-3 text-zinc-500">
                # Keys are converted from UPPER_SNAKE_CASE to dotted.lowercase
              </p>
              <p className="text-zinc-500">
                # and stored in your OS credential store.
              </p>
              <p className="text-zinc-500">
                # The original .env file can be deleted.
              </p>
              <p className="mt-3 text-zinc-500">
                # To generate a .env file at any time:
              </p>
              <p>
                <span className="text-emerald-400">$</span>{" "}
                <span className="text-zinc-200">
                  envsec -c myapp.dev env-file
                </span>
              </p>
            </div>
          </div>

          {/* Step 2 — Run your app */}
          <p className="mx-auto mb-4 max-w-2xl text-center font-semibold text-sm">
            Run your app with secrets injected
          </p>
          <div className="mx-auto mb-6 max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
            <div className="flex items-center gap-2 border-white/5 border-b px-4 py-2">
              <span className="h-3 w-3 rounded-full bg-red-500/60" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <span className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 font-mono text-muted-foreground text-xs">
                terminal
              </span>
            </div>
            <div className="space-y-1 p-4 font-mono text-sm">
              <p className="text-zinc-500">
                # Start a shell with all secrets as env vars
              </p>
              <p>
                <span className="text-emerald-400">$</span>{" "}
                <span className="text-zinc-200">envsec -c myapp.dev shell</span>
              </p>
              <p className="text-zinc-500">
                ● envsec shell — context: myapp.dev (12 secrets loaded)
              </p>
              <p>
                <span className="text-emerald-400">$</span>{" "}
                <span className="text-zinc-200">npm run dev</span>
              </p>
            </div>
          </div>

          {/* Step 3 — SDK comparison */}
          <p className="mx-auto mb-4 max-w-2xl text-center font-semibold text-sm">
            Or use the SDK — no .env file, no shell wrapper
          </p>
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
            {/* envsec SDK */}
            <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-zinc-950">
              <div className="flex items-center gap-2 border-emerald-500/10 border-b px-4 py-2">
                <span className="font-mono text-emerald-400 text-xs">
                  @envsec/sdk
                </span>
              </div>
              <div className="p-4 font-mono text-sm leading-relaxed">
                <p>
                  <span className="text-purple-400">import</span>{" "}
                  <span className="text-zinc-200">{"{"}</span>{" "}
                  <span className="text-zinc-200">loadSecrets</span>{" "}
                  <span className="text-zinc-200">{"}"}</span>{" "}
                  <span className="text-purple-400">from</span>{" "}
                  <span className="text-emerald-300">
                    &quot;@envsec/sdk&quot;
                  </span>
                  <span className="text-zinc-200">;</span>
                </p>
                <p className="mt-2">
                  <span className="text-purple-400">await</span>{" "}
                  <span className="text-cyan-300">loadSecrets</span>
                  <span className="text-zinc-200">({"{"}</span>
                </p>
                <p>
                  <span className="text-zinc-200">{"  "}context:</span>{" "}
                  <span className="text-emerald-300">
                    &quot;myapp.dev&quot;
                  </span>
                  <span className="text-zinc-200">,</span>
                </p>
                <p>
                  <span className="text-zinc-200">{"  "}inject:</span>{" "}
                  <span className="text-orange-300">true</span>
                </p>
                <p>
                  <span className="text-zinc-200">{"})"}</span>
                  <span className="text-zinc-200">;</span>
                </p>
              </div>
            </div>

            {/* dotenv */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
              <div className="flex items-center gap-2 border-white/5 border-b px-4 py-2">
                <span className="font-mono text-muted-foreground text-xs">
                  dotenv
                </span>
              </div>
              <div className="p-4 font-mono text-sm leading-relaxed">
                <p>
                  <span className="text-purple-400">import</span>{" "}
                  <span className="text-zinc-400">dotenv</span>{" "}
                  <span className="text-purple-400">from</span>{" "}
                  <span className="text-zinc-500">&quot;dotenv&quot;</span>
                  <span className="text-zinc-400">;</span>
                </p>
                <p className="mt-2">
                  <span className="text-zinc-400">dotenv</span>
                  <span className="text-zinc-500">.</span>
                  <span className="text-zinc-400">config</span>
                  <span className="text-zinc-400">()</span>
                  <span className="text-zinc-400">;</span>
                </p>
                <p className="mt-2 text-zinc-600">
                  {"// reads plaintext .env"}
                </p>
              </div>
            </div>

            {/* 1Password */}
            <div className="overflow-hidden rounded-xl border border-blue-500/20 bg-zinc-950">
              <div className="flex items-center gap-2 border-blue-500/10 border-b px-4 py-2">
                <span className="font-mono text-blue-400 text-xs">op CLI</span>
              </div>
              <div className="p-4 font-mono text-sm leading-relaxed">
                <p className="text-zinc-500">{"# inject via secret refs"}</p>
                <p>
                  <span className="text-blue-400">op</span>{" "}
                  <span className="text-zinc-200">run --</span>{" "}
                  <span className="text-zinc-400">node app.js</span>
                </p>
                <p className="mt-2 text-zinc-500">
                  {"# or read a single secret"}
                </p>
                <p>
                  <span className="text-blue-400">op</span>{" "}
                  <span className="text-zinc-200">read</span>{" "}
                  <span className="text-zinc-400">op://vault/item/key</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed comparison */}
        <div className="mb-20 animate-reveal">
          <h2 className="mb-8 text-center font-semibold text-2xl tracking-tight">
            Feature by feature
          </h2>
          <div className="flex flex-col gap-4">
            {COMPARISON_ROWS.map((row) => (
              <div
                className="rounded-xl border border-white/10 bg-zinc-950/50 p-6"
                key={row.feature}
              >
                <h3 className="mb-4 font-semibold">{row.feature}</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                    <span className="mb-1 block font-mono text-emerald-400 text-xs">
                      envsec
                    </span>
                    <span className="text-sm leading-relaxed">
                      {row.envsec}
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                    <span className="mb-1 block font-mono text-muted-foreground text-xs">
                      dotenv
                    </span>
                    <span className="text-muted-foreground text-sm leading-relaxed">
                      {row.dotenv}
                    </span>
                  </div>
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                    <span className="mb-1 block font-mono text-blue-400 text-xs">
                      1Password CLI
                    </span>
                    <span className="text-sm leading-relaxed">
                      {row.onepassword}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="animate-reveal text-center">
          <div className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-zinc-950/50 px-8 py-6">
            <p className="mb-2 font-semibold">Three tools, three trade-offs</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              dotenv is the simplest approach — files on disk, zero setup.
              1Password CLI is the most feature-rich for teams with cloud sync,
              RBAC, and audit logs — but requires a paid subscription. envsec
              sits in between: OS-native encryption with zero accounts, zero
              cloud dependencies, and a developer-focused workflow that goes
              beyond what .env files can do. It imports your existing .env files
              and can generate them on demand, so you keep full compatibility
              while gaining encryption, audit trails, and team sharing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
