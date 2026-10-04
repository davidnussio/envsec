import { Check, Minus, X } from "lucide-react";

const COMPARISON_ROWS = [
  {
    dotenv: "Plaintext .env files on disk (dotenvx adds per-file encryption)",
    envsec:
      "OS native credential store (Keychain, GNOME Keyring, Credential Manager)",
    feature: "Secret storage",
    onepassword: "1Password cloud vault (AES-256 encrypted)",
  },
  {
    dotenv: "None (dotenv) / ECIES per-file (dotenvx)",
    envsec: "Handled by OS — battle-tested, hardware-backed on macOS",
    feature: "Encryption at rest",
    onepassword: "AES-256 in 1Password cloud, dual-key derivation",
  },
  {
    dotenv: ".env files are plaintext by default",
    envsec: "Never — values go straight to OS credential store",
    feature: "Secrets on disk",
    onepassword: "Never locally — fetched at runtime from cloud",
  },
  {
    dotenv: "High — requires .gitignore discipline",
    envsec: "Zero — secrets never exist as files",
    feature: "Git leak risk",
    onepassword: "Zero — secrets live in cloud vault",
  },
  {
    dotenv: "Full — files are local",
    envsec: "Full — secrets are local in OS store",
    feature: "Offline access",
    onepassword: "Requires network (cached items available offline in app)",
  },
  {
    dotenv: "Free and open source",
    envsec: "None — free, open source, no signup",
    feature: "Account / subscription",
    onepassword: "Paid — from ~$3/mo individual, ~$8/user/mo business",
  },
  {
    dotenv: "Manual file management (.env.dev, .env.prod, …)",
    envsec: "Built-in contexts (myapp.dev, myapp.prod, …)",
    feature: "Multi-environment",
    onepassword: "Vaults and items, 1Password Environments (beta)",
  },
  {
    dotenv: "grep through files",
    envsec: "Glob search across all contexts and keys",
    feature: "Secret search",
    onepassword: "op item list with --tags / --category filtering",
  },
  {
    dotenv: "Not supported",
    envsec:
      "Set TTL on secrets, audit for expired credentials and tracked .env files",
    feature: "Expiry & audit",
    onepassword: "Watchtower (in app, not CLI)",
  },
  {
    dotenv: "Git-based sharing with encrypted .env (dotenvx)",
    envsec: "GPG-encrypted export/import",
    feature: "Team sharing",
    onepassword: "Built-in vault sharing, RBAC, team provisioning, audit logs",
  },
  {
    dotenv: "source .env or framework-specific loaders",
    envsec: "eval $(envsec env) — supports bash, zsh, fish, PowerShell",
    feature: "Shell integration",
    onepassword: "op run --env-file, shell plugins with biometric auth",
  },
  {
    dotenv: "dotenvx run -- cmd injects from encrypted .env",
    envsec:
      "{key} placeholders + --inject env vars — secrets never in ps output or history",
    feature: "Command runner",
    onepassword:
      "op run -- cmd injects via secret references (op://Vault/Item/field)",
  },
  {
    dotenv: "Not built-in",
    envsec: "envsec shell — scoped subshell with auto-cleanup",
    feature: "Interactive shell session",
    onepassword: "Not built-in",
  },
  {
    dotenv: "Not built-in",
    envsec: "envsec cmd — save, list, search, run, delete",
    feature: "Saved commands",
    onepassword: "Not built-in",
  },
  {
    dotenv: "Manual file editing",
    envsec: "move, copy, rename between contexts with metadata preserved",
    feature: "Move / copy / rename",
    onepassword: "op item move between vaults, op item edit",
  },
  {
    dotenv: "Not built-in",
    envsec: "envsec tui — full-screen terminal UI for all operations",
    feature: "Interactive TUI",
    onepassword: "Not built-in (desktop app is GUI)",
  },
  {
    dotenv: "Not built-in",
    envsec: "envsec doctor — checks platform, keychain, DB integrity",
    feature: "Health diagnostics",
    onepassword: "Not built-in",
  },
  {
    dotenv: "Not built-in",
    envsec: "Dynamic — contexts, keys, commands for bash, zsh, fish",
    feature: "Shell completions",
    onepassword: "Static completions for bash, zsh, fish, PowerShell",
  },
  {
    dotenv: "require('dotenv').config() — core use case",
    envsec: "@envsec/sdk for Node.js / Bun",
    feature: "SDK / programmatic access",
    onepassword: "1Password SDKs for Node.js, Python, Go, and more",
  },
  {
    dotenv: "File-based, works everywhere but no OS integration",
    envsec: "macOS, Linux, Windows — auto-detected backend",
    feature: "Cross-platform",
    onepassword: "macOS, Linux, Windows",
  },
  {
    dotenv: "Native format — .env files are the source of truth",
    envsec: "Import from and export to .env files on demand",
    feature: ".env compatibility",
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
    dotenv: "None",
    envsec: "Inherits OS biometrics (e.g. macOS Keychain unlock)",
    feature: "Biometric auth",
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
    dotenv: false,
    envsec: true,
    label: "Secrets encrypted at rest",
    onepassword: true,
  },
  {
    dotenv: false,
    envsec: true,
    label: "No plaintext files on disk",
    onepassword: true,
  },
  {
    dotenv: false,
    envsec: true,
    label: "OS-level access control",
    onepassword: false,
  },
  {
    dotenv: true,
    envsec: true,
    label: "Works offline",
    onepassword: "partial",
  },
  {
    dotenv: true,
    envsec: true,
    label: "No account or subscription",
    onepassword: false,
  },
  {
    dotenv: false,
    envsec: true,
    label: "Built-in secret rotation audit",
    onepassword: "partial",
  },
  {
    dotenv: false,
    envsec: true,
    label: "Context-based organization",
    onepassword: true,
  },
  {
    dotenv: false,
    envsec: true,
    label: "GPG-encrypted sharing",
    onepassword: false,
  },
  { dotenv: false, envsec: true, label: "Interactive TUI", onepassword: false },
  {
    dotenv: false,
    envsec: true,
    label: "Saved command templates",
    onepassword: false,
  },
  {
    dotenv: false,
    envsec: false,
    label: "Team management & RBAC",
    onepassword: true,
  },
  {
    dotenv: true,
    envsec: "asterisk",
    label: "Zero config to start",
    onepassword: false,
  },
  {
    dotenv: true,
    envsec: true,
    label: "Works with existing .env files",
    onepassword: "partial",
  },
  {
    dotenv: true,
    envsec: true,
    label: "Framework agnostic",
    onepassword: true,
  },
  { dotenv: true, envsec: true, label: "Open source", onepassword: false },
] as const;

const CheckIcon = () => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
    <Check className="h-4 w-4 text-emerald-400" />
  </span>
);

const CheckAsteriskIcon = () => (
  <span className="inline-flex items-center gap-0.5">
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
      <Check className="h-4 w-4 text-emerald-400" />
    </span>
    <span className="text-muted-foreground font-mono text-xs">*</span>
  </span>
);

const PartialIcon = () => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500/10">
    <Minus className="h-4 w-4 text-yellow-400" />
  </span>
);

const XIcon = () => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10">
    <X className="h-4 w-4 text-red-400" />
  </span>
);

const StatusIcon = ({ value }: { value: CheckValue }) => {
  if (value === "asterisk") {
    return <CheckAsteriskIcon />;
  }
  if (value === "partial") {
    return <PartialIcon />;
  }
  return value ? <CheckIcon /> : <XIcon />;
};

export const Comparison = () => (
  <div className="px-4 py-32 sm:px-6">
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="animate-reveal mb-20 text-center">
        <p className="mb-3 font-mono text-sm text-emerald-400">Comparison</p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
          envsec vs dotenv vs 1Password CLI
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
          Three approaches to managing secrets. One stores them in plaintext
          files, one locks them in the cloud, and one keeps them in your OS.
        </p>
      </div>

      {/* Quick checklist */}
      <div className="animate-reveal mb-20">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
          At a glance
        </h2>
        <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/50">
          <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 border-b border-white/5 px-4 py-3 sm:grid-cols-[1fr_100px_100px_100px] sm:gap-4 sm:px-6">
            <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Capability
            </span>
            <span className="text-center font-mono text-xs tracking-wider text-emerald-400 uppercase">
              envsec
            </span>
            <span className="text-muted-foreground text-center font-mono text-xs tracking-wider uppercase">
              dotenv
            </span>
            <span className="text-center font-mono text-xs tracking-wider text-blue-400 uppercase">
              1Password
            </span>
          </div>
          {CHECKLIST.map((row) => (
            <div
              className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 border-b border-white/5 px-4 py-3 text-sm last:border-0 sm:grid-cols-[1fr_100px_100px_100px] sm:gap-4 sm:px-6"
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
      <div className="animate-reveal mb-20">
        <h2 className="mb-4 text-center text-2xl font-semibold tracking-tight">
          Migrate from dotenv in 60 seconds
        </h2>
        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-center">
          Already using .env files? envsec imports them directly.
        </p>

        {/* Step 1 — Import */}
        <div className="mx-auto mb-6 max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
            <span className="h-3 w-3 rounded-full bg-red-500/60" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <span className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="text-muted-foreground ml-2 font-mono text-xs">
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
        <p className="mx-auto mb-4 max-w-2xl text-center text-sm font-semibold">
          Run your app with secrets injected
        </p>
        <div className="mx-auto mb-6 max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
            <span className="h-3 w-3 rounded-full bg-red-500/60" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <span className="h-3 w-3 rounded-full bg-green-500/60" />
            <span className="text-muted-foreground ml-2 font-mono text-xs">
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
        <p className="mx-auto mb-4 max-w-2xl text-center text-sm font-semibold">
          Or use the SDK — no .env file, no shell wrapper
        </p>
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
          {/* envsec SDK */}
          <div className="overflow-hidden rounded-xl border border-emerald-500/20 bg-zinc-950">
            <div className="flex items-center gap-2 border-b border-emerald-500/10 px-4 py-2">
              <span className="font-mono text-xs text-emerald-400">
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
                <span className="text-emerald-300">&quot;myapp.dev&quot;</span>
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
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
              <span className="text-muted-foreground font-mono text-xs">
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
                &#47;&#47; reads plaintext .env
              </p>
            </div>
          </div>

          {/* 1Password */}
          <div className="overflow-hidden rounded-xl border border-blue-500/20 bg-zinc-950">
            <div className="flex items-center gap-2 border-b border-blue-500/10 px-4 py-2">
              <span className="font-mono text-xs text-blue-400">op CLI</span>
            </div>
            <div className="p-4 font-mono text-sm leading-relaxed">
              <p className="text-zinc-500"># inject via secret refs</p>
              <p>
                <span className="text-blue-400">op</span>{" "}
                <span className="text-zinc-200">run --</span>{" "}
                <span className="text-zinc-400">node app.js</span>
              </p>
              <p className="mt-2 text-zinc-500"># or read a single secret</p>
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
      <div className="animate-reveal mb-20">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
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
                  <span className="mb-1 block font-mono text-xs text-emerald-400">
                    envsec
                  </span>
                  <span className="text-sm leading-relaxed">{row.envsec}</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                  <span className="text-muted-foreground mb-1 block font-mono text-xs">
                    dotenv
                  </span>
                  <span className="text-muted-foreground text-sm leading-relaxed">
                    {row.dotenv}
                  </span>
                </div>
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
                  <span className="mb-1 block font-mono text-xs text-blue-400">
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
            RBAC, and audit logs — but requires a paid subscription. envsec sits
            in between: OS-native encryption with zero accounts, zero cloud
            dependencies, and a developer-focused workflow that goes beyond what
            .env files can do. It imports your existing .env files and can
            generate them on demand, so you keep full compatibility while
            gaining encryption, audit trails, and team sharing.
          </p>
        </div>
      </div>
    </div>
  </div>
);
