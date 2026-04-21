"use client";

import { CodeBlock } from "./code-block";

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section className="mb-16 scroll-mt-20" id={id}>
      {children}
    </section>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-bold text-2xl tracking-tight">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-3 font-semibold text-lg">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-muted-foreground leading-relaxed">{children}</p>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-emerald-400 text-sm">
      {children}
    </code>
  );
}

export function DocsContent() {
  return (
    <article className="max-w-3xl">
      <h1 className="mb-2 font-bold text-4xl tracking-tight">Documentation</h1>
      <p className="mb-12 text-lg text-muted-foreground">
        Everything you need to manage secrets with envsec.
      </p>

      {/* Getting Started */}
      <Section id="installation">
        <H2>Installation</H2>
        <H3>Homebrew (macOS / Linux)</H3>
        <CodeBlock
          code={"brew tap davidnussio/homebrew-tap\nbrew install envsec"}
        />
        <H3>npm</H3>
        <P>Requires Node.js 22 or later.</P>
        <CodeBlock code="npm install -g envsec" />
        <P>Or run directly without installing:</P>
        <CodeBlock code="npx envsec" />
        <H3>mise</H3>
        <CodeBlock code="mise use -g npm:envsec" />
      </Section>

      {/* Why envsec? */}
      <Section id="why-envsec">
        <H2>Why envsec?</H2>
        <P>
          After the Shai-Hulud npm attack (September 2025), I audited my old
          client projects and found 97 <Mono>.env</Mono> files with live
          credentials. Side projects, POCs, test apps, course exercises. Just
          files parked on disk, in plaintext, surviving every reboot.
        </P>
        <P>Your OS already has a vault. envsec uses it.</P>
      </Section>

      <Section id="quick-start">
        <H2>Quick Start</H2>
        <P>
          Store your first secret. The <Mono>-c</Mono> flag sets the context — a
          label for grouping related secrets.
        </P>
        <CodeBlock
          code={`# Store a secret
envsec -c myapp.dev add api.key -v "sk-abc123"

# Retrieve it
envsec -c myapp.dev get api.key

# List all secrets in the context
envsec -c myapp.dev list

# Run a command with secret interpolation
envsec -c myapp.dev run 'curl -H "Auth: {api.key}" https://api.example.com'`}
        />
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <span aria-hidden="true" className="shrink-0 text-emerald-400">
            ℹ
          </span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Set up{" "}
            <a
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
              href="#shell-completions"
            >
              shell completions
            </a>{" "}
            and unlock the full power of tab. It&apos;s over 9000 times better —
            trust us, your fingers will thank you.
          </p>
        </div>
      </Section>

      <Section id="requirements">
        <H2>Requirements</H2>
        <H3>macOS</H3>
        <P>
          No extra dependencies. Uses the built-in Keychain via the security CLI
          tool.
        </P>
        <H3>Linux</H3>
        <P>
          Requires <Mono>libsecret-tools</Mono> (provides the{" "}
          <Mono>secret-tool</Mono> command), which talks to GNOME Keyring, KDE
          Wallet, or any Secret Service API provider via D-Bus.
        </P>
        <CodeBlock
          code={`# Debian / Ubuntu
sudo apt install libsecret-tools

# Fedora
sudo dnf install libsecret

# Arch
sudo pacman -S libsecret`}
        />
        <H3>Windows</H3>
        <P>
          No extra dependencies. Uses the built-in Windows Credential Manager
          via cmdkey and PowerShell.
        </P>
      </Section>

      {/* Commands */}
      <Section id="add">
        <H2>envsec add</H2>
        <P>Store a secret in the OS credential store.</P>
        <CodeBlock
          code={`# Inline value
envsec -c myapp.dev add api.key --value "sk-abc123"

# Interactive masked prompt (omit --value)
envsec -c myapp.dev add api.key

# With expiry duration
envsec -c myapp.dev add api.key -v "sk-abc123" --expires 30d

# Supported units: m (minutes), h (hours), d (days),
# w (weeks), mo (months), y (years)
# Combinable: 1y6mo, 2w3d, 1d12h
envsec -c myapp.dev add api.key -v "sk-abc123" -e 6mo`}
        />
      </Section>

      <Section id="get">
        <H2>envsec get</H2>
        <P>Retrieve a single secret value.</P>
        <CodeBlock
          code={`envsec -c myapp.dev get api.key

# Print only the raw value (no warnings or extra output)
envsec -c myapp.dev get api.key --quiet
envsec -c myapp.dev get api.key -q`}
        />
        <P>
          Use <Mono>--quiet</Mono> (<Mono>-q</Mono>) for scripting — it
          suppresses expiry warnings and outputs only the secret value.
        </P>
      </Section>

      <Section id="delete">
        <H2>envsec delete</H2>
        <P>Remove a secret from the credential store.</P>
        <CodeBlock
          code={`envsec -c myapp.dev delete api.key

# Skip confirmation prompt
envsec -c myapp.dev delete api.key --yes

# Alias
envsec -c myapp.dev del api.key`}
        />
      </Section>

      <Section id="rename">
        <H2>envsec rename</H2>
        <P>
          Rename a secret key within the same context. The value and expiry
          metadata are preserved.
        </P>
        <CodeBlock
          code={`# Rename a key
envsec -c myapp.dev rename old.key new.key

# Overwrite target if it already exists
envsec -c myapp.dev rename old.key existing.key --force`}
        />
      </Section>

      <Section id="list">
        <H2>envsec list</H2>
        <P>List all secrets in a context, or list all contexts.</P>
        <CodeBlock
          code={`# List secrets in a context
envsec -c myapp.dev list

# List all contexts (without -c)
envsec list`}
        />
      </Section>

      <Section id="search">
        <H2>envsec search</H2>
        <P>Search secrets or contexts with glob patterns.</P>
        <CodeBlock
          code={`# Search secrets within a context
envsec -c myapp.dev search "api.*"

# Search contexts by pattern
envsec search "myapp.*"`}
        />
      </Section>

      <Section id="move">
        <H2>envsec move</H2>
        <P>
          Move secrets from one context to another. The source secrets are
          removed after moving.
        </P>
        <CodeBlock
          code={`# Move a single secret
envsec -c myapp.dev move api.token --to myapp.prod

# Move secrets matching a glob pattern
envsec -c myapp.dev move "redis.*" --to myapp.prod -y

# Move all secrets from one context to another
envsec -c myapp.dev move --all --to myapp.prod -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev move "redis.*" --to myapp.prod --force -y`}
        />
      </Section>

      <Section id="copy">
        <H2>envsec copy</H2>
        <P>
          Copy secrets from one context to another. The source secrets remain
          intact.
        </P>
        <CodeBlock
          code={`# Copy a single secret
envsec -c myapp.dev copy api.token --to myapp.staging

# Copy secrets matching a glob pattern
envsec -c myapp.dev copy "redis.*" --to myapp.staging -y

# Copy all secrets from one context to another
envsec -c myapp.dev copy --all --to myapp.staging -y

# Overwrite existing secrets in the target context
envsec -c myapp.dev copy "redis.*" --to myapp.staging --force -y`}
        />
      </Section>

      <Section id="run">
        <H2>envsec run</H2>
        <P>
          Execute a command with secret interpolation. Placeholders like{" "}
          <Mono>{"{key}"}</Mono> are resolved and injected as environment
          variables — values never appear in <Mono>ps</Mono> output.
        </P>
        <CodeBlock
          code={`# Run with secret interpolation
envsec -c myapp.dev run 'curl {api.url} -H "Authorization: Bearer {api.token}"'

# Inject ALL context secrets as environment variables
envsec -c myapp.dev run --inject 'node server.js'
envsec -c myapp.dev run -i 'docker compose up'

# Combine --inject with placeholders
envsec -c myapp.dev run --inject 'curl {api.url} -H "Authorization: Bearer $API_TOKEN"'

# Save the command for later
envsec -c myapp.dev run --save --name deploy 'kubectl apply -f - <<< {k8s.manifest}'`}
        />
        <P>
          With <Mono>--inject</Mono> (<Mono>-i</Mono>), every secret in the
          context is exported as an environment variable using UPPER_SNAKE_CASE
          (e.g. <Mono>db.password</Mono> → <Mono>DB_PASSWORD</Mono>). Explicit{" "}
          <Mono>{"{key}"}</Mono> placeholders take precedence over injected
          variables.
        </P>
      </Section>

      <Section id="cmd">
        <H2>envsec cmd</H2>
        <P>Manage saved commands.</P>
        <CodeBlock
          code={`# List saved commands
envsec cmd list

# Run a saved command
envsec cmd run deploy

# Run quietly (suppress informational output)
envsec cmd run deploy --quiet
envsec cmd run deploy -q

# Inject all context secrets as env vars
envsec cmd run deploy --inject
envsec cmd run deploy -i

# Override context at execution time
envsec cmd run deploy --override-context myapp.prod

# Search saved commands
envsec cmd search psql

# Delete a saved command
envsec cmd delete deploy`}
        />
      </Section>

      <Section id="env-file">
        <H2>envsec env-file</H2>
        <P>Export secrets to a .env file.</P>
        <CodeBlock
          code={`# Default output: .env
envsec -c myapp.dev env-file

# Custom output path
envsec -c myapp.dev env-file --output .env.local`}
        />
      </Section>

      <Section id="env">
        <H2>envsec env</H2>
        <P>Export secrets as shell environment variable statements.</P>
        <CodeBlock
          code={`# bash/zsh
eval $(envsec -c myapp.dev env)

# fish
envsec -c myapp.dev env --shell fish

# powershell
envsec -c myapp.dev env --shell powershell

# Unset exported variables
eval $(envsec -c myapp.dev env --unset)`}
        />
        <P>
          Keys are converted to UPPER_SNAKE_CASE (e.g. <Mono>api.token</Mono> →{" "}
          <Mono>API_TOKEN</Mono>).
        </P>
      </Section>

      <Section id="shell">
        <H2>envsec shell</H2>
        <P>
          Spawn a new shell with all secrets from a context injected as
          environment variables. The parent environment is inherited by default.
          Type <Mono>exit</Mono> or press <Mono>Ctrl+D</Mono> to leave — secrets
          are cleared when the session ends.
        </P>
        <CodeBlock
          code={`# Start a shell with secrets loaded
envsec -c myapp.dev shell

# Use a specific shell
envsec -c myapp.dev shell --shell fish

# Don't inherit parent environment variables
envsec -c myapp.dev shell --no-inherit

# Suppress startup/exit banner
envsec -c myapp.dev shell --quiet`}
        />
        <P>
          Keys are converted to UPPER_SNAKE_CASE (e.g. <Mono>api.token</Mono> →{" "}
          <Mono>API_TOKEN</Mono>). On bash and zsh the prompt is prefixed with{" "}
          <Mono>(envsec:context)</Mono> so you know you&apos;re inside an envsec
          session.
        </P>
        <P>
          Supported shells: <Mono>bash</Mono>, <Mono>zsh</Mono>,{" "}
          <Mono>fish</Mono>, <Mono>powershell</Mono> / <Mono>pwsh</Mono>. When
          no <Mono>--shell</Mono> flag is given, envsec auto-detects from the{" "}
          <Mono>$SHELL</Mono> environment variable.
        </P>
      </Section>

      <Section id="load">
        <H2>envsec load</H2>
        <P>Import secrets from a .env file into a context.</P>
        <CodeBlock
          code={`# Import from .env
envsec -c myapp.dev load

# Custom input file
envsec -c myapp.dev load --input .env.local

# Overwrite existing secrets
envsec -c myapp.dev load --force`}
        />
      </Section>

      <Section id="share">
        <H2>envsec share</H2>
        <P>Encrypt secrets with GPG for team sharing.</P>
        <CodeBlock
          code={`# Encrypt for a team member
envsec -c myapp.dev share --encrypt-to [email]

# Save to file
envsec -c myapp.dev share --encrypt-to [email] -o secrets.enc

# JSON format inside encrypted payload
envsec -c myapp.dev --json share --encrypt-to [email] -o secrets.enc`}
        />
        <P>
          The recipient decrypts with <Mono>gpg --decrypt secrets.enc</Mono> and
          pipes the result into <Mono>envsec load</Mono>.
        </P>
      </Section>

      <Section id="audit">
        <H2>envsec audit</H2>
        <P>Check for expired or expiring secrets.</P>
        <CodeBlock
          code={`# Default window: 30 days
envsec -c myapp.dev audit

# Custom window
envsec -c myapp.dev audit --within 7d

# Only already-expired
envsec -c myapp.dev audit --within 0d

# Audit all contexts
envsec audit

# JSON output
envsec -c myapp.dev audit --json`}
        />
      </Section>

      <Section id="secret">
        <H2>envsec secret</H2>
        <P>
          Generate a cryptographically secure random secret. When both a context
          and key name are provided, the value is stored in the credential
          store. Without either, it works as a standalone password generator
          that prints the raw value to stdout.
        </P>
        <CodeBlock
          code={`# Generate and store a 32-char alphanumeric secret
envsec -c myapp.dev secret api.key

# Custom length and prefix
envsec -c myapp.dev secret api.key --prefix "sk_" --length 48

# Character sets:
#   --alphanumeric (-a)  [a-zA-Z0-9] (default)
#   --special (-s)       [a-zA-Z0-9] + !@#$%^&*
#   --all-chars (-A)     all printable ASCII
envsec -c myapp.dev secret db.password --special --length 64

# With expiry
envsec -c myapp.dev secret api.key --prefix "sk_" -l 48 --expires 90d

# Standalone password generator (no store, just print)
envsec secret --length 32
envsec secret --special --length 64 --prefix "pk_"`}
        />
        <P>
          When both context and key are present, the value is stored and
          printed. Without either, the raw value goes to stdout — perfect for
          piping to <Mono>pbcopy</Mono>, <Mono>xclip</Mono>, or any other tool.
        </P>
      </Section>

      <Section id="doctor">
        <H2>envsec doctor</H2>
        <P>
          Run a suite of health checks to verify your envsec installation and
          environment. Useful when troubleshooting setup issues.
        </P>
        <CodeBlock
          code={`# Run all health checks
envsec doctor

# JSON output
envsec --json doctor`}
        />
        <P>Checks performed:</P>
        <ul className="mb-4 list-inside list-disc space-y-1 text-muted-foreground">
          <li>
            <Mono>Version</Mono> — currently installed envsec version
          </li>
          <li>
            <Mono>Platform</Mono> — OS and kernel version, confirms it is
            supported
          </li>
          <li>
            <Mono>Node.js</Mono> — runtime version (22+ required)
          </li>
          <li>
            <Mono>Shell</Mono> — active shell detected from the environment
          </li>
          <li>
            <Mono>Environment</Mono> — detects <Mono>ENVSEC_DB</Mono> and{" "}
            <Mono>ENVSEC_CONTEXT</Mono> overrides
          </li>
          <li>
            <Mono>Credential store</Mono> — verifies the OS credential backend
            is accessible (Keychain, Secret Service, or Credential Manager)
          </li>
          <li>
            <Mono>Keychain read/write</Mono> — writes, reads back, and deletes a
            probe secret to confirm full access
          </li>
          <li>
            <Mono>Database</Mono> — checks that the metadata directory and
            SQLite file exist and have correct permissions
          </li>
          <li>
            <Mono>Database integrity</Mono> — queries the schema to confirm the
            database is not corrupted
          </li>
          <li>
            <Mono>Orphaned secrets</Mono> — detects keys present in metadata but
            missing from the keychain
          </li>
          <li>
            <Mono>Expired secrets</Mono> — flags secrets whose expiry date has
            already passed
          </li>
        </ul>
        <P>
          A summary line at the end shows how many checks passed and how many
          failed. Use the <Mono>--json</Mono> flag to get structured output
          suitable for scripting or CI diagnostics.
        </P>
      </Section>

      {/* Interactive TUI */}
      <Section id="tui-overview">
        <H2>Interactive TUI</H2>
        <P>
          envsec includes a full-screen terminal UI for managing secrets without
          memorizing commands. Launch it with <Mono>envsec tui</Mono> or
          optionally pass a context to start in.
        </P>
        <CodeBlock
          code={`# Launch the TUI
envsec tui

# Launch with a pre-selected context
envsec -c myapp.dev tui`}
        />
        <P>
          The TUI uses raw ANSI escape sequences with zero external
          dependencies. It runs in an alternate screen buffer so your terminal
          history stays clean.
        </P>
      </Section>

      <Section id="tui-views">
        <H2>Views &amp; Screens</H2>
        <P>
          The main menu provides access to eight screens, each covering a core
          envsec workflow.
        </P>
        <H3>Contexts</H3>
        <P>
          Browse all contexts with their secret counts. Press <Mono>s</Mono> to
          set the selected context as the active context for the session,{" "}
          <Mono>x</Mono> to clear the active context, <Mono>Enter</Mono> to view
          its secrets, or <Mono>d</Mono> to delete all secrets in a context
          (with confirmation).
        </P>
        <H3>Secrets</H3>
        <P>
          Lists all secrets in the current context as a table with key, last
          updated, and expiry columns. Press <Mono>Enter</Mono> to reveal a
          secret value, <Mono>a</Mono> to add a new secret, or <Mono>d</Mono> to
          delete the selected secret.
        </P>
        <H3>Add Secret</H3>
        <P>
          Interactive form to store a new secret. Prompts for key, value (masked
          input), and an optional expiry duration (e.g. <Mono>30d</Mono>,{" "}
          <Mono>1y</Mono>, <Mono>6mo</Mono>).
        </P>
        <H3>Search</H3>
        <P>
          Glob pattern search. With a context selected, searches secret keys.
          Without a context, searches context names.
        </P>
        <H3>Saved Commands</H3>
        <P>
          Lists all saved commands in a table with name, command template, and
          context. Press <Mono>d</Mono> to delete a command.
        </P>
        <H3>Audit</H3>
        <P>
          Scans for secrets expiring within 30 days. Shows expired vs. expiring
          status with time distance. Also lists tracked <Mono>.env</Mono> file
          exports and cleans up stale records for files that no longer exist on
          disk.
        </P>
        <H3>Import .env</H3>
        <P>
          Prompts for a file path (defaults to <Mono>.env</Mono>) and imports
          all key-value pairs into the current context. Keys are converted from{" "}
          <Mono>UPPER_SNAKE_CASE</Mono> to <Mono>dotted.lowercase</Mono>.
        </P>
        <H3>Export .env</H3>
        <P>
          Prompts for an output path (defaults to <Mono>.env</Mono>) and writes
          all secrets from the current context. The export is tracked in
          metadata for the audit view.
        </P>
      </Section>

      <Section id="tui-keyboard">
        <H2>Keyboard Shortcuts</H2>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-white/10 border-b text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Key</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>↑ / ↓</Mono>
                </td>
                <td className="py-2">Navigate menu items and table rows</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>Enter</Mono>
                </td>
                <td className="py-2">Select / confirm</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>c</Mono>
                </td>
                <td className="py-2">Open contexts view (main menu)</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>s</Mono>
                </td>
                <td className="py-2">
                  Set selected as active context (contexts view)
                </td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>x</Mono>
                </td>
                <td className="py-2">Clear active context (contexts view)</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>a</Mono>
                </td>
                <td className="py-2">Add a new secret (secrets view)</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>d</Mono>
                </td>
                <td className="py-2">Delete selected item</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>r</Mono>
                </td>
                <td className="py-2">Reveal secret value (detail view)</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>Esc</Mono>
                </td>
                <td className="py-2">Go back / cancel</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>q</Mono>
                </td>
                <td className="py-2">Quit the TUI</td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>Ctrl+C</Mono>
                </td>
                <td className="py-2">Quit the TUI</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Configuration */}
      <Section id="contexts">
        <H2>Contexts</H2>
        <P>
          A context is a free-form label for grouping secrets — e.g.{" "}
          <Mono>myapp.dev</Mono>, <Mono>stripe-api.prod</Mono>,{" "}
          <Mono>work.staging</Mono>. Most commands require a context specified
          with <Mono>--context</Mono> (or <Mono>-c</Mono>).
        </P>
        <P>
          Keys must contain at least one dot separator (e.g.{" "}
          <Mono>service.account</Mono>) which maps to the credential
          store&apos;s service/account structure.
        </P>
      </Section>

      <Section id="database">
        <H2>Custom Database Path</H2>
        <P>
          By default, metadata is stored at <Mono>~/.envsec/store.sqlite</Mono>.
          Override with <Mono>--db</Mono> or the <Mono>ENVSEC_DB</Mono>{" "}
          environment variable.
        </P>
        <CodeBlock
          code={`# Project-local database
envsec --db ./local-store.sqlite -c myapp.dev list

# Via environment variable
export ENVSEC_DB=/shared/team/envsec.sqlite
envsec -c myapp.dev list`}
        />
      </Section>

      <Section id="shell-completions">
        <H2>Shell Completions</H2>
        <P>Tab completion for bash, zsh, fish, and sh.</P>
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <span aria-hidden="true" className="shrink-0 text-emerald-400">
            ℹ
          </span>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Installed via Homebrew? Shell completions are configured
            automatically — you&apos;re already good to go.
          </p>
        </div>
        <CodeBlock
          code={`# Bash (add to ~/.bashrc)
eval "$(envsec --completions bash)"

# Zsh (add to ~/.zshrc)
eval "$(envsec --completions zsh)"

# Fish (add to ~/.config/fish/config.fish)
envsec --completions fish | source`}
        />
      </Section>

      {/* SDK */}
      <Section id="sdk-overview">
        <H2>SDK Overview</H2>
        <P>
          <Mono>@envsec/sdk</Mono> is a Node.js / Bun SDK that gives your
          applications programmatic access to envsec secrets. Load secrets at
          startup, inject them into <Mono>process.env</Mono>, or manage them
          with a full lifecycle client — no CLI needed.
        </P>
        <P>
          Two API styles are available: a functional one-shot API (
          <Mono>loadSecrets</Mono>, <Mono>withSecrets</Mono>) for simple use
          cases, and a class-based API (<Mono>EnvsecClient</Mono>) for
          multi-operation workflows.
        </P>
      </Section>

      <Section id="sdk-installation">
        <H2>SDK Installation</H2>
        <P>
          Requires Node.js &ge; 22 and a working envsec setup (OS credential
          store accessible).
        </P>
        <CodeBlock
          code={"npm install @envsec/sdk\n# or\npnpm add @envsec/sdk"}
        />
      </Section>

      <Section id="sdk-functional-api">
        <H2>Functional API</H2>
        <P>
          One-shot functions for the most common use cases. No lifecycle
          management needed — the client is created and closed automatically.
        </P>
        <H3>loadSecrets</H3>
        <P>
          Load all secrets from one or more contexts. Optionally inject them
          into <Mono>process.env</Mono>.
        </P>
        <CodeBlock
          code={`import { loadSecrets } from "@envsec/sdk"

// Load only
const secrets = await loadSecrets({ context: "myapp.dev" })
console.log(secrets["api.key"])

// Load and inject into process.env
await loadSecrets({ context: "myapp.prod", inject: true })
// process.env.API_KEY is now set`}
        />
        <H3>withSecrets</H3>
        <P>
          Run a callback with secrets available. When <Mono>inject: true</Mono>,{" "}
          <Mono>process.env</Mono> is automatically restored after the callback
          completes.
        </P>
        <CodeBlock
          code={`import { withSecrets } from "@envsec/sdk"

const result = await withSecrets(
  { context: "myapp.dev", inject: true },
  async (secrets) => {
    // process.env.API_TOKEN is set here
    return fetch(secrets["api.url"])
  }
)
// process.env is restored to its original state`}
        />
      </Section>

      <Section id="sdk-client-api">
        <H2>Client API</H2>
        <P>
          Full lifecycle client for multi-operation workflows. Supports get,
          set, delete, and bulk loading.
        </P>
        <CodeBlock
          code={`import { EnvsecClient } from "@envsec/sdk"

const client = await EnvsecClient.create({ context: "myapp.dev" })

// Read
const apiKey = await client.get("api.key")      // string | null
const dbUrl = await client.require("db.url")     // string (throws if missing)

// Write
await client.set("api.key", "sk-new-value")
await client.set("api.key", "sk-new-value", { expires: "30d" })

// Delete
await client.delete("api.key")

// Bulk
const all = await client.loadAll()               // Record<string, string>
await client.injectEnv()                         // inject all into process.env

// Always close when done
await client.close()`}
        />
      </Section>

      <Section id="sdk-multi-context">
        <H2>Multi-Context</H2>
        <P>
          Pass an array of contexts to merge secrets from multiple sources.
          Later contexts override earlier ones (left-to-right merge).
        </P>
        <CodeBlock
          code={`const client = await EnvsecClient.create({
  context: ["myapp.defaults", "myapp.dev"],
})

// "myapp.dev" values win over "myapp.defaults"
const secrets = await client.loadAll()
await client.close()`}
        />
        <P>
          Write operations (<Mono>set</Mono>, <Mono>delete</Mono>) target the
          last (primary) context.
        </P>
      </Section>

      <Section id="sdk-options">
        <H2>Options Reference</H2>
        <H3>EnvsecClientOptions</H3>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-white/10 border-b text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Option</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>context</Mono>
                </td>
                <td className="py-2 pr-4">
                  <Mono>string | string[]</Mono>
                </td>
                <td className="py-2">
                  Context(s) to operate on. Array enables multi-context merge.
                </td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>dbPath</Mono>
                </td>
                <td className="py-2 pr-4">
                  <Mono>string</Mono>
                </td>
                <td className="py-2">
                  Override default SQLite path (
                  <Mono>~/.envsec/store.sqlite</Mono>).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <H3>LoadSecretsOptions / WithSecretsOptions</H3>
        <P>
          Extends <Mono>EnvsecClientOptions</Mono> with:
        </P>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-white/10 border-b text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Option</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Default</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>inject</Mono>
                </td>
                <td className="py-2 pr-4">
                  <Mono>boolean</Mono>
                </td>
                <td className="py-2 pr-4">
                  <Mono>false</Mono>
                </td>
                <td className="py-2">
                  Inject secrets into <Mono>process.env</Mono> after loading.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <H3>Key Transformation</H3>
        <P>
          When injecting into <Mono>process.env</Mono>, keys are converted to
          UPPER_SNAKE_CASE:
        </P>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-white/10 border-b text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Secret Key</th>
                <th className="py-2 font-medium">Environment Variable</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>api.token</Mono>
                </td>
                <td className="py-2">
                  <Mono>API_TOKEN</Mono>
                </td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>db.connection</Mono>
                </td>
                <td className="py-2">
                  <Mono>DB_CONNECTION</Mono>
                </td>
              </tr>
              <tr className="border-white/5 border-b">
                <td className="py-2 pr-4">
                  <Mono>redis.cache-url</Mono>
                </td>
                <td className="py-2">
                  <Mono>REDIS_CACHE_URL</Mono>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Security */}
      <Section id="security-model">
        <H2>Security Model</H2>
        <P>
          envsec delegates encryption to your OS native credential store. It
          never invents its own crypto. Secret values go straight from your
          terminal into the OS credential store — they are never written to
          config files, logs, or intermediate storage.
        </P>
        <P>
          The <Mono>list</Mono> and <Mono>search</Mono> commands display key
          names only — values are never printed. The <Mono>run</Mono> command
          injects secrets as environment variables of the child process rather
          than interpolating them into the command string, keeping values out of{" "}
          <Mono>ps</Mono> output and shell history.
        </P>
        <P>
          The metadata directory (<Mono>~/.envsec/</Mono>) is created with 0700
          permissions and the SQLite database with 0600, limiting access to the
          owning user.
        </P>
      </Section>

      <Section id="limitations">
        <H2>Known Limitations</H2>
        <ul className="list-inside list-disc space-y-3 text-muted-foreground">
          <li>
            The SQLite database stores key names, context names, and timestamps
            — never secret values, but enough to reveal what secrets exist.
          </li>
          <li>
            The <Mono>env-file</Mono> command writes secret values to a .env
            file on disk. Treat the output file accordingly.
          </li>
          <li>
            The <Mono>run</Mono> command passes templates through /bin/sh. Only
            run templates you wrote or trust.
          </li>
          <li>
            Any process running as your OS user can read all secrets across all
            contexts.
          </li>
          <li>
            On Linux, envsec depends on an active D-Bus session and a keyring
            daemon.
          </li>
        </ul>
      </Section>
    </article>
  );
}
