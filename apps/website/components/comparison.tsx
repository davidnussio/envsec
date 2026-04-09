import { Check, X } from "lucide-react";

const COMPARISON_ROWS = [
  {
    feature: "Secret storage",
    envsec:
      "OS native credential store (Keychain, GNOME Keyring, Credential Manager)",
    dotenv: "Plaintext .env files on disk",
  },
  {
    feature: "Encryption",
    envsec: "Handled by OS — battle-tested, hardware-backed on macOS",
    dotenv: "None — values stored as-is",
  },
  {
    feature: "Git leak risk",
    envsec: "Zero — secrets never exist as files",
    dotenv: "High — requires .gitignore discipline",
  },
  {
    feature: "Multi-environment",
    envsec: "Built-in contexts (myapp.dev, myapp.prod, …)",
    dotenv: "Manual file management (.env.dev, .env.prod, …)",
  },
  {
    feature: "Secret search",
    envsec: "Glob search across all contexts",
    dotenv: "grep through files",
  },
  {
    feature: "Expiry & audit",
    envsec: "Set TTL on secrets, audit for expired credentials",
    dotenv: "Not supported",
  },
  {
    feature: "Team sharing",
    envsec: "GPG-encrypted export/import",
    dotenv: "Copy-paste via Slack/email",
  },
  {
    feature: "Shell integration",
    envsec: "eval $(envsec env) — supports bash, zsh, fish, PowerShell",
    dotenv: "source .env or framework-specific loaders",
  },
  {
    feature: "Command runner",
    envsec:
      "{key} placeholders injected as env vars — secrets never appear in ps output or shell history",
    dotenv: "Requires dotenv-cli or similar wrapper",
  },
  {
    feature: "Cross-platform",
    envsec: "macOS, Linux, Windows — auto-detected backend",
    dotenv: "File-based, works everywhere but no OS integration",
  },
  {
    feature: "Interactive prompts",
    envsec: "Masked input prompts, context-aware shell completions",
    dotenv: "Not available",
  },
  {
    feature: ".env compatibility",
    envsec: "Import from and export to .env files on demand",
    dotenv: "Native format",
  },
] as const;

type CheckValue = true | false | "asterisk";

const CHECKLIST: readonly {
  label: string;
  envsec: CheckValue;
  dotenv: CheckValue;
}[] = [
  { label: "Secrets encrypted at rest", envsec: true, dotenv: false },
  { label: "No plaintext files on disk", envsec: true, dotenv: false },
  { label: "OS-level access control", envsec: true, dotenv: false },
  { label: "Built-in secret rotation audit", envsec: true, dotenv: false },
  { label: "Context-based organization", envsec: true, dotenv: false },
  { label: "GPG-encrypted sharing", envsec: true, dotenv: false },
  { label: "Zero config to start", envsec: "asterisk", dotenv: true },
  { label: "Works with existing .env files", envsec: true, dotenv: true },
  { label: "Framework agnostic", envsec: true, dotenv: true },
  { label: "Open source", envsec: true, dotenv: true },
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
  return value ? <CheckIcon /> : <XIcon />;
}

export function Comparison() {
  return (
    <div className="px-4 py-32 sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-20 animate-reveal text-center">
          <p className="mb-3 font-mono text-emerald-400 text-sm">Comparison</p>
          <h1 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">
            envsec vs dotenv
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
            dotenv loads secrets from disk. envsec never writes them there.
          </p>
        </div>

        {/* Quick checklist */}
        <div className="mb-20 animate-reveal">
          <h2 className="mb-8 text-center font-semibold text-2xl tracking-tight">
            At a glance
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950/50">
            <div className="grid grid-cols-[1fr_80px_80px] gap-4 border-white/5 border-b px-6 py-3 sm:grid-cols-[1fr_120px_120px]">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Capability
              </span>
              <span className="text-center font-mono text-emerald-400 text-xs uppercase tracking-wider">
                envsec
              </span>
              <span className="text-center font-mono text-muted-foreground text-xs uppercase tracking-wider">
                dotenv
              </span>
            </div>
            {CHECKLIST.map((row) => (
              <div
                className="grid grid-cols-[1fr_80px_80px] items-center gap-4 border-white/5 border-b px-6 py-3 text-sm last:border-0 sm:grid-cols-[1fr_120px_120px]"
                key={row.label}
              >
                <span>{row.label}</span>
                <span className="flex justify-center">
                  <StatusIcon value={row.envsec} />
                </span>
                <span className="flex justify-center">
                  <StatusIcon value={row.dotenv} />
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
              envsec requires Node.js &ge; 22. dotenv supports Node.js &ge; 12.
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
          <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
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
                  <span className="text-purple-400">const</span>{" "}
                  <span className="text-zinc-200">secrets</span>{" "}
                  <span className="text-zinc-500">=</span>{" "}
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
                <p className="mt-2 text-zinc-500">
                  {"// process.env.API_KEY is now set"}
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
                  <span className="text-zinc-400">({"{"}</span>
                </p>
                <p>
                  <span className="text-zinc-400">{"  "}path:</span>{" "}
                  <span className="text-zinc-500">
                    &quot;/custom/path/to/.env&quot;
                  </span>
                </p>
                <p>
                  <span className="text-zinc-400">{"})"}</span>
                  <span className="text-zinc-400">;</span>
                </p>
                <p className="mt-2 text-zinc-600">
                  {"// reads plaintext from disk"}
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
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="animate-reveal text-center">
          <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-zinc-950/50 px-8 py-6">
            <p className="mb-2 font-semibold">Not a replacement — an upgrade</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              envsec imports your existing .env files and can generate them on
              demand for tools that need them. You keep full compatibility with
              your current workflow while gaining OS-level encryption, audit
              trails, and team sharing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
