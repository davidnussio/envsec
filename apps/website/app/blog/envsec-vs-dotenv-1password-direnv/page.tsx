import Link from "next/link";

import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  DataTable,
  ExternalLink,
  H2,
  List,
  Mono,
  P,
  Strong,
} from "@/components/blog/prose";
import { CodeBlock } from "@/components/code-block";
import { TerminalBlock } from "@/components/terminal-block";

const SLUG = "envsec-vs-dotenv-1password-direnv";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const SUMMARY_COLUMNS = [
  { label: "" },
  { label: "envsec" },
  { label: "dotenv" },
  { label: "direnv" },
  { label: "1Password CLI" },
] as const;

const SUMMARY_ROWS = [
  [
    "Stores secrets in",
    "OS credential store",
    "Plaintext .env",
    "Nothing of its own",
    "1Password vault",
  ],
  [
    "Encrypted at rest",
    "Yes, by the OS",
    "No (dotenvx: yes)",
    "Not applicable",
    "Yes",
  ],
  [
    "Gets values into",
    "A command or your shell",
    "process.env",
    "Your shell",
    "A command (op run)",
  ],
  [
    "Team sharing",
    "One-off GPG file",
    "Out of band",
    "Out of band",
    "Shared vaults",
  ],
  [
    "Access control",
    "Your OS login",
    "File permissions",
    "File permissions",
    "Per-vault permissions",
  ],
  ["Account needed", "No", "No", "No", "Yes"],
  ["Cost", "Free (MIT)", "Free (BSD-2)", "Free (MIT)", "Paid subscription"],
  ["Offline", "Yes", "Yes", "Yes", "Check their docs"],
  [
    "CI",
    "Not designed for it",
    "Platform env vars",
    "Not its job",
    "Service accounts",
  ],
] as const;

const ENVSEC_DAILY = `# Import an existing .env once
envsec -c myapp.dev load -i .env
# Run the app with every secret of the context injected
envsec -c myapp.dev run --inject 'npm run dev'
# Or pass one secret to one command
envsec -c myapp.dev run 'psql {db.url}'`;

const ENVRC_CONTEXT = `# .envrc: choose the context for this directory, export no secrets
export ENVSEC_CONTEXT=myapp.dev`;

const ENVRC_EXPORT = `# .envrc: export every secret of the context into your shell
eval "$(envsec -c myapp.dev env)"`;

const DOTENV_PLUS_ENVSEC = `# .env holds PORT, LOG_LEVEL, API_BASE_URL. No secrets.
# envsec injects the secrets; dotenv won't override them.
envsec -c myapp.dev run --inject 'npm run dev'`;

const EnvsecVsDotenvPost = () => (
  <PostLayout
    lead={
      <p>
        Your app reads a database password and an API key from environment
        variables. The open questions are where those values live when nothing
        is running, and how they reach the process when something is. dotenv,
        direnv, 1Password CLI and envsec all come up when you search for an
        answer, and they answer different parts of it.
      </p>
    }
    slug={SLUG}
  >
    <P>
      I wrote envsec, so read this with that in mind. I&apos;ve tried to be
      fair: for several of the cases below envsec is the wrong tool, and I say
      so. The{" "}
      <Link className={LINK_CLASS} href="/compare">
        comparison page
      </Link>{" "}
      has the feature grid; this is the long version, with the trade-offs.
    </P>

    <H2>Two questions, four tools</H2>
    <P>
      Every secrets setup answers two questions: where is the value stored, and
      how does it get into the process that needs it? The four tools split like
      this:
    </P>
    <List>
      <li>
        <Strong>dotenv</Strong> only answers the second question. It reads a
        file and copies its values into <Mono>process.env</Mono>. Storage is
        whatever file you wrote.
      </li>
      <li>
        <Strong>direnv</Strong> also answers only the second question, at the
        shell level: it loads variables when you enter a directory and unloads
        them when you leave.
      </li>
      <li>
        <Strong>1Password CLI</Strong> answers both. Values live in a 1Password
        vault, and <Mono>op</Mono> hands them to your command at run time.
      </li>
      <li>
        <Strong>envsec</Strong> answers both, locally. Values live in your
        operating system&apos;s credential store, and envsec hands them to a
        command or prints them for your shell.
      </li>
    </List>
    <P>
      That&apos;s why &quot;dotenv or envsec&quot; is partly a false choice, and
      why direnv pairs well with any of the others.
    </P>

    <H2>dotenv: the default, and fine for configuration</H2>
    <P>
      <ExternalLink href="https://github.com/motdotla/dotenv">
        dotenv
      </ExternalLink>{" "}
      is a zero-dependency Node.js module that loads a <Mono>.env</Mono> file
      into <Mono>process.env</Mono>. Many frameworks read <Mono>.env</Mono>{" "}
      files on their own, and loaders exist for most languages, so the format is
      everywhere.
    </P>
    <List>
      <li>
        <Strong>Where secrets live:</Strong> in a plaintext file in your
        project. The dotenv README answers &quot;Should I commit my .env
        file?&quot; with a no.
      </li>
      <li>
        <Strong>Team sharing:</Strong> out of band: someone sends you the file
        or its contents. Its companion project{" "}
        <ExternalLink href="https://github.com/dotenvx/dotenvx">
          dotenvx
        </ExternalLink>{" "}
        encrypts the values so the file can be committed, and you share the
        private key separately.
      </li>
      <li>
        <Strong>Cost and offline:</Strong> free (BSD-2-Clause), and it&apos;s a
        file, so it works anywhere.
      </li>
      <li>
        <Strong>CI:</Strong> usually you don&apos;t ship a <Mono>.env</Mono> to
        CI at all. The platform sets environment variables, and dotenv leaves
        them alone: by default it never modifies a variable that is already set.
      </li>
      <li>
        <Strong>Ergonomics:</Strong> hard to beat. Edit a file, call one
        function at startup.
      </li>
    </List>
    <P>
      dotenv is the better choice for non-secret configuration (ports, log
      levels, local URLs, feature flags), for a committed{" "}
      <Mono>.env.example</Mono> that documents what a project needs, and in
      containers and CI, where something else already injects the real values.
      The trouble starts when the same file also holds the database password.
      Any process running as you can read it: editor extensions, backup tools, a{" "}
      <Link className={LINK_CLASS} href="/blog/ai-coding-agents-read-your-env">
        coding agent indexing your project
      </Link>
      .
    </P>

    <H2>direnv: per-directory environments</H2>
    <P>
      <ExternalLink href="https://direnv.net/">direnv</ExternalLink> is a shell
      extension. Before each prompt it looks for an <Mono>.envrc</Mono> in the
      current and parent directories, runs it in a bash subprocess, and applies
      the resulting changes to your shell. Leave the directory and the changes
      are undone. It has hooks for bash, zsh, fish and several other shells.
    </P>
    <List>
      <li>
        <Strong>Where secrets live:</Strong> wherever <Mono>.envrc</Mono> gets
        them. An <Mono>export API_KEY=…</Mono> line in <Mono>.envrc</Mono> is a
        plaintext file, the same as a <Mono>.env</Mono>. direnv&apos;s standard
        library can also load a <Mono>.env</Mono> file for you.
      </li>
      <li>
        <Strong>Safety:</Strong> direnv refuses to run a new or modified{" "}
        <Mono>.envrc</Mono> until you approve it with <Mono>direnv allow</Mono>.
        That protects you from a cloned repository running code when you{" "}
        <Mono>cd</Mono> into it.
      </li>
      <li>
        <Strong>Team sharing, cost, offline:</Strong> no sharing (it&apos;s
        about your shell), free (MIT), fully local.
      </li>
      <li>
        <Strong>CI:</Strong> not its job. CI jobs don&apos;t have an interactive
        shell moving between directories.
      </li>
      <li>
        <Strong>Ergonomics:</Strong> excellent once set up. You <Mono>cd</Mono>{" "}
        into a project and the variables are there.
      </li>
    </List>
    <P>
      One thing to know before you load secrets with it: the variables end up in
      your interactive shell, so every command you start from that shell
      inherits them. direnv also keeps its own bookkeeping in a{" "}
      <Mono>DIRENV_DIFF</Mono> variable. On my machine (direnv 2.37.1) that
      variable contains the values it set, compressed but not encrypted.
    </P>
    <P>
      direnv is the better choice for switching per-project settings that
      aren&apos;t secret, and as glue that calls a real secret store. More on
      that below.
    </P>

    <H2>1Password CLI: secrets for a team</H2>
    <P>
      <ExternalLink href="https://www.1password.dev/cli/">
        1Password CLI
      </ExternalLink>{" "}
      (<Mono>op</Mono>) is the command-line client for a 1Password account. Its{" "}
      <ExternalLink href="https://www.1password.dev/cli/secrets-environment-variables/">
        <Mono>op run</Mono>
      </ExternalLink>{" "}
      command reads environment variables whose values are secret references
      such as <Mono>op://development/GitHub/credentials/personal_token</Mono>,
      from your environment or an <Mono>--env-file</Mono>, and starts your
      command with the real values for the lifetime of that process.
    </P>
    <List>
      <li>
        <Strong>Where secrets live:</Strong> in a vault in your 1Password
        account, not in the project.
      </li>
      <li>
        <Strong>Team sharing:</Strong> this is where it is strongest. Vaults are
        shared with teammates, access is granted and revoked centrally, and when
        someone changes a value, the next <Mono>op run</Mono> picks it up for
        everyone.
      </li>
      <li>
        <Strong>Cost:</Strong> it needs a 1Password account, which is a paid
        subscription. The CLI isn&apos;t open source.
      </li>
      <li>
        <Strong>Offline:</Strong> I haven&apos;t tested how far <Mono>op</Mono>{" "}
        gets without a network connection, and the pages I link here don&apos;t
        promise it, so I won&apos;t claim either way.
      </li>
      <li>
        <Strong>CI:</Strong> service accounts scoped to specific vaults, and{" "}
        <ExternalLink href="https://www.1password.dev/ci-cd/github-actions/">
          CI/CD integrations
        </ExternalLink>{" "}
        such as GitHub Actions. Laptops and pipelines read from the same source.
      </li>
      <li>
        <Strong>Ergonomics:</Strong> a committed file full of <Mono>op://</Mono>{" "}
        references documents which secrets a project needs without containing
        any of them. Sign-in can use your fingerprint through the desktop app.
      </li>
    </List>
    <P>
      If more than a couple of people share production credentials, if you need
      to revoke someone&apos;s access when they leave, or if an auditor asks who
      can read what, 1Password CLI is the better choice. If your company already
      pays for 1Password, start there.
    </P>

    <H2>envsec: the OS keychain, from the command line</H2>
    <P>
      envsec stores each secret in the operating system&apos;s credential store:
      the macOS Keychain, the Secret Service on Linux (through{" "}
      <Mono>secret-tool</Mono>), or the Windows Credential Manager. Metadata
      (key names, timestamps, optional expiry dates) goes into a SQLite file,{" "}
      <Mono>~/.envsec/store.sqlite</Mono> by default. Values never go into
      SQLite. Secrets are grouped by context, such as <Mono>myapp.dev</Mono> or{" "}
      <Mono>stripe-api.prod</Mono>.
    </P>
    <TerminalBlock code={ENVSEC_DAILY} />
    <P>
      With <Mono>run</Mono>, a <Mono>{"{db.url}"}</Mono> placeholder becomes a
      reference to an environment variable that only the child process sees, so
      the value isn&apos;t pasted into the command line. There is also{" "}
      <Mono>envsec shell</Mono> for a subshell with the secrets loaded,{" "}
      <Mono>envsec env</Mono> for <Mono>eval</Mono>, and{" "}
      <Mono>envsec env-file</Mono> for tools that insist on a <Mono>.env</Mono>{" "}
      file (envsec records where it wrote them, and <Mono>envsec audit</Mono>{" "}
      lists them along with expired secrets).
    </P>
    <List>
      <li>
        <Strong>Where secrets live:</Strong> in the OS credential store,
        encrypted by the OS and tied to your login.
      </li>
      <li>
        <Strong>Team sharing:</Strong> <Mono>envsec share</Mono> encrypts a
        context for one GPG recipient. You hand over a file; nothing syncs.{" "}
        <Link className={LINK_CLASS} href="/blog/sharing-secrets-with-gpg">
          Sharing secrets with GPG
        </Link>{" "}
        covers how it works.
      </li>
      <li>
        <Strong>Cost and offline:</Strong> free (MIT), no account, and
        everything is local.
      </li>
      <li>
        <Strong>CI:</Strong> not designed for it. envsec needs a credential
        store, and a headless Linux runner doesn&apos;t have one unless you
        start it yourself. I do that with gnome-keyring to{" "}
        <Link className={LINK_CLASS} href="/blog/testing-keychains-in-ci">
          test envsec in CI
        </Link>
        , but for your pipeline secrets, use your CI provider&apos;s secret
        store.
      </li>
    </List>
    <P>
      What envsec doesn&apos;t do: sync between machines, permissions, an access
      log, or rotation. It tracks expiry dates you set with{" "}
      <Mono>add --expires</Mono> and reports them in <Mono>audit</Mono>, but it
      doesn&apos;t rotate anything. It also doesn&apos;t protect you from
      software running as your user: on my Mac, reading a secret that envsec
      stored doesn&apos;t show a prompt. The{" "}
      <Link className={LINK_CLASS} href="/blog/envsec-threat-model">
        threat model post
      </Link>{" "}
      goes into the details.
    </P>

    <H2>At a glance</H2>
    <DataTable
      caption="Third-party columns reflect the official docs linked in this post. Check them before you decide."
      columns={SUMMARY_COLUMNS}
      rows={SUMMARY_ROWS}
    />

    <H2>They combine better than they compete</H2>
    <P>
      <Strong>direnv plus envsec.</Strong> The lightest version uses direnv only
      to pick the envsec context for a directory. No secret enters your shell;
      envsec reads the <Mono>ENVSEC_CONTEXT</Mono> variable when you don&apos;t
      pass <Mono>-c</Mono>, so <Mono>envsec run --inject</Mono> inside that
      directory uses the right context:
    </P>
    <CodeBlock code={ENVRC_CONTEXT} language="bash" />
    <P>
      If you want the secrets in your shell as plain variables, let direnv
      evaluate <Mono>envsec env</Mono>. direnv runs <Mono>.envrc</Mono> in bash,
      so the default bash syntax is the right one even if your interactive shell
      is fish. I tested this with direnv 2.37.1:
    </P>
    <CodeBlock code={ENVRC_EXPORT} language="bash" />
    <P>
      The trade-off is the one above: the values now live in your shell and in{" "}
      <Mono>DIRENV_DIFF</Mono>, and direnv calls envsec again each time it
      reloads the directory. I prefer the first version.
    </P>
    <P>
      <Strong>dotenv plus envsec.</Strong> Keep non-secret settings in{" "}
      <Mono>.env</Mono> and the secrets in envsec. Because dotenv doesn&apos;t
      override variables that are already set, the injected secrets win, and the
      file never needs to contain them:
    </P>
    <TerminalBlock code={DOTENV_PLUS_ENVSEC} />
    <P>
      <Strong>1Password plus envsec.</Strong> Use 1Password for what the team
      shares and for CI, and envsec for what is only yours: personal tokens,
      side projects, the things you would otherwise keep in a <Mono>.env</Mono>{" "}
      in your home directory.
    </P>

    <H2>Which one, when</H2>
    <List>
      <li>
        <Strong>dotenv</Strong> for non-secret configuration, for templates like{" "}
        <Mono>.env.example</Mono>, and wherever the platform injects variables
        for you (containers, CI). Keep secrets out of the file.
      </li>
      <li>
        <Strong>direnv</Strong> for per-directory environments, and as glue
        between your shell and a secret store.
      </li>
      <li>
        <Strong>1Password CLI</Strong> when a team shares secrets, when you need
        access control and revocation, or when CI and laptops should read from
        one source.
      </li>
      <li>
        <Strong>envsec</Strong> when you want the secrets on your own machine
        off disk and out of your projects, without an account or a network, and
        an occasional GPG file is enough sharing for you.
      </li>
    </List>
    <P>
      If you&apos;re starting from a folder of <Mono>.env</Mono> files,{" "}
      <Link className={LINK_CLASS} href="/blog/migrate-from-dotenv-to-keychain">
        From .env to the keychain in five minutes
      </Link>{" "}
      walks through the move. The{" "}
      <Link className={LINK_CLASS} href="/compare">
        comparison page
      </Link>{" "}
      has the feature-by-feature grid.
    </P>
  </PostLayout>
);

export default EnvsecVsDotenvPost;
