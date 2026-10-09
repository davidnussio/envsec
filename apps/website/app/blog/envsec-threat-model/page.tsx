import Link from "next/link";

import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  DataTable,
  ExternalLink,
  H2,
  H3,
  List,
  Mono,
  P,
  Strong,
} from "@/components/blog/prose";
import { TerminalBlock } from "@/components/terminal-block";

const SLUG = "envsec-threat-model";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const SCOPE_COLUMNS = [
  { label: "" },
  { highlight: true, label: "Protected" },
] as const;

const SCOPE_ROWS = [
  ["Accidental commit of a secrets file", "yes"],
  ["grep, editor indexing, project backups", "yes"],
  ["Other local users (default permissions)", "mostly"],
  ["Processes running as you", "no"],
  ["Children of a process you gave secrets to", "no"],
  ["Root, or a stolen unencrypted disk", "no"],
] as const;

const ENVIRON_DEMO = `# Linux: the environment of a process you own is one file read away
envsec -c myapp.dev run --inject 'sleep 60' &
tr '\\0' '\\n' < /proc/$(pgrep -n sleep)/environ | grep DATABASE_URL`;

const ADD_DEMO = `# The value lands in shell history and in envsec's own arguments
envsec -c myapp.dev add stripe.key --value 'the-actual-secret'
# Masked prompt: one * per character, nothing in history
envsec -c myapp.dev add stripe.key
# ◆ Enter secret value: *****************
# ✔ Secret "stripe.key" stored in context "myapp.dev"`;

const RUN_DEMO = `envsec -c myapp.dev run 'psql "{database.url}"'
# /bin/sh runs: psql "$ENVSEC_0_DATABASE_URL"
# with ENVSEC_0_DATABASE_URL set in its environment`;

const ThreatModelPost = () => (
  <PostLayout
    lead={
      <p>
        Every secrets tool has a threat model, whether or not it writes one
        down. This is envsec&apos;s, including the parts that don&apos;t flatter
        it. I checked each claim against the code, and I cite the file where it
        matters.
      </p>
    }
    slug={SLUG}
  >
    <H2>What envsec is for</H2>
    <P>
      envsec moves secret values out of plaintext files and into the OS
      credential store: the macOS Keychain through Apple&apos;s{" "}
      <Mono>security</Mono> tool, the Secret Service on Linux through{" "}
      <Mono>secret-tool</Mono>, and Windows Credential Manager through
      PowerShell. Key names, timestamps and expiry dates go into a SQLite file.
      Values leave the store when you run a command that needs them:{" "}
      <Mono>get</Mono>, <Mono>run</Mono>, <Mono>shell</Mono>, <Mono>env</Mono>,{" "}
      <Mono>env-file</Mono>, <Mono>share</Mono>, or the reveal key in the TUI.
    </P>
    <P>
      The assets are the values. The threat it is designed for is accidental
      exposure: a commit, a grep, a backup of the project folder, a container
      build context, a coding agent opening the wrong file. It is not designed
      to stop code that already runs as your user.
    </P>
    <DataTable
      caption="The short version. Each row is explained below."
      columns={SCOPE_COLUMNS}
      rows={SCOPE_ROWS}
    />

    <H2>What it does not protect you from</H2>

    <H3>Anything running as you can read every secret</H3>
    <P>
      On macOS, envsec creates items with{" "}
      <Mono>security add-generic-password</Mono> and reads them with{" "}
      <Mono>find-generic-password -w</Mono> (
      <Mono>packages/core/src/implementations/mac-os-keychain-access.ts</Mono>
      ). The tool&apos;s own help says that, by default, the application that
      creates an item is trusted to read it without a warning. So any process
      running as you can call <Mono>security</Mono> and get the value while the
      login keychain is unlocked, and in my tests no dialog appears.
    </P>
    <P>
      On Linux, a keyring unlocked at login typically answers any client in your
      session over D-Bus. On Windows, generic credentials are readable by any
      process running as your user; that is how envsec itself reads them.
    </P>
    <P>
      Contexts don&apos;t change this. A context is a naming scheme: the key{" "}
      <Mono>db.password</Mono> in <Mono>myapp.prod</Mono> becomes the service{" "}
      <Mono>envsec.myapp.prod.db</Mono> and the account <Mono>password</Mono> (
      <Mono>packages/core/src/domain/secret-key.ts</Mono>). There is no
      authorization between contexts.
    </P>

    <H3>Environment variables are not a vault</H3>
    <P>
      <Mono>run --inject</Mono>, <Mono>shell</Mono> and <Mono>{"{key}"}</Mono>{" "}
      placeholders all end the same way: the value sits in the environment of a
      child process. On Linux, <Mono>/proc/&lt;pid&gt;/environ</Mono> holds the
      environment a process started with, and it is readable by the same user
      and by root:
    </P>
    <TerminalBlock code={ENVIRON_DEMO} />
    <P>
      Children inherit the environment, so the values reach everything the
      process starts. <Mono>envsec run --inject &apos;npm install&apos;</Mono>{" "}
      would hand them to every dependency&apos;s install script. Inject into the
      command that needs the secrets, not into a whole toolchain.{" "}
      <Mono>shell --no-inherit</Mono> drops the parent environment except{" "}
      <Mono>PATH</Mono>, but the secrets are still there by design.
    </P>

    <H3>eval lasts as long as your shell</H3>
    <P>
      <Mono>eval &quot;$(envsec env)&quot;</Mono> doesn&apos;t put values in
      your history: the history records the <Mono>eval</Mono> line, not its
      output. It does put them in your interactive shell for the rest of the
      session, inherited by every command you start, including an editor or a
      coding agent. <Mono>envsec env --unset</Mono> prints the matching{" "}
      <Mono>unset</Mono> lines. For anything but a short session, prefer{" "}
      <Mono>run</Mono>, which scopes the values to one process.
    </P>

    <H3>The value passes through process arguments on macOS and Windows</H3>
    <P>
      To store a value on macOS, envsec runs{" "}
      <Mono>security add-generic-password -U -s … -a … -w &lt;value&gt;</Mono>.
      The value is base64-encoded with an <Mono>envsec:b64:</Mono> prefix, which
      is encoding, not encryption. While <Mono>security</Mono> runs, it is in
      that process&apos;s arguments, visible at least to other processes running
      as you. Apple&apos;s help for the command calls the <Mono>-w</Mono> option
      insecure for exactly this reason. On Windows, the value is embedded in the
      script passed to <Mono>powershell.exe -Command</Mono>, with the same
      exposure. On Linux, envsec writes it to <Mono>secret-tool</Mono> on stdin,
      which avoids it.
    </P>
    <P>
      The window is short, but a same-user process polling the process list
      could catch it. If that is in your threat model, so is everything else in
      this section.
    </P>

    <H3>add --value puts the secret in your history</H3>
    <P>
      An inline value is saved by your shell&apos;s history and is part of
      envsec&apos;s own command line while it runs. On Linux,{" "}
      <Mono>/proc/&lt;pid&gt;/cmdline</Mono> is readable by every local user
      unless <Mono>/proc</Mono> is mounted with <Mono>hidepid</Mono>. Use the
      prompt, or pipe the value in on stdin from another program:
    </P>
    <TerminalBlock code={ADD_DEMO} />
    <P>
      The prompt echoes one <Mono>*</Mono> per character on a terminal, so a
      screen recording shows the length of the secret, not its content.
    </P>

    <H3>run goes through a shell</H3>
    <P>
      <Mono>run</Mono> and <Mono>cmd run</Mono> execute the command with{" "}
      <Mono>/bin/sh</Mono>, or <Mono>cmd.exe</Mono> on Windows (
      <Mono>packages/cli/src/cli/execute-command.ts</Mono>). A command template
      is code: only run templates you wrote. Saved templates live in the
      metadata database, so whoever can write that file can change what{" "}
      <Mono>cmd run deploy</Mono> executes.
    </P>
    <P>
      Placeholder values are not pasted into the command text. envsec replaces
      each one with a reference to a variable it sets in the child&apos;s
      environment (<Mono>packages/cli/src/cli/resolve-command.ts</Mono>):
    </P>
    <TerminalBlock code={RUN_DEMO} />
    <P>
      With <Mono>/bin/sh</Mono>, a value containing <Mono>;</Mono> or{" "}
      <Mono>$(…)</Mono> is expanded as data, not run. An unquoted reference is
      still split on whitespace, so quote your placeholders. On Windows, since
      envsec 1.1.3, the reference is <Mono>!VAR!</Mono> and the command runs
      under <Mono>cmd /v:on</Mono>: delayed expansion happens after{" "}
      <Mono>cmd.exe</Mono> has parsed the line, so <Mono>&amp;</Mono> and{" "}
      <Mono>|</Mono> in a value stay literal. Earlier versions used{" "}
      <Mono>%VAR%</Mono>, which <Mono>cmd.exe</Mono> expands before it looks for
      those operators; if you are on one of them, prefer <Mono>--inject</Mono>{" "}
      and read the variable in your program.
    </P>

    <H3>The metadata database tells a story</H3>
    <P>
      <Mono>~/.envsec/store.sqlite</Mono> holds context names, key names,
      creation and update times, expiry dates, saved command templates and the
      paths of <Mono>.env</Mono> files you exported. No values, but enough to
      tell someone which services you use and where to look. A completion cache
      next to it lists contexts and keys too. envsec creates the directory with
      mode <Mono>0700</Mono> and both files with <Mono>0600</Mono>, and resets
      the permissions of the database file and of <Mono>~/.envsec</Mono> every
      time it opens them (
      <Mono>packages/core/src/implementations/sqlite-metadata-store.ts</Mono>
      ). That keeps other local users out. It does nothing against processes
      running as you, or a backup tool that copies your home directory.
    </P>

    <H3>env-file and share write files</H3>
    <P>
      <Mono>env-file</Mono> writes a plaintext <Mono>.env</Mono>, which is what
      envsec exists to avoid; it is there as a bridge for tools that only read
      files. Since envsec 1.1.3 it creates the file with mode <Mono>0600</Mono>{" "}
      and tightens an existing file it overwrites; earlier versions used the
      default permissions from your umask, typically <Mono>0644</Mono>, which
      other local users can read. envsec records the path, and{" "}
      <Mono>envsec audit</Mono> lists generated files and forgets the ones you
      deleted. It cannot track copies.
    </P>
    <P>
      <Mono>share</Mono> encrypts with GPG using{" "}
      <Mono>--trust-model always</Mono>, so it encrypts to whichever key in your
      keyring matches the recipient, without checking its trust level. Verify
      the fingerprint before you send anything.
    </P>

    <H3>Expiry is a reminder, not a lock</H3>
    <P>
      <Mono>--expires</Mono> stores a date in the metadata. <Mono>get</Mono>{" "}
      prints a warning after it and <Mono>audit</Mono> lists the secret, but the
      value stays readable, and <Mono>run</Mono> and <Mono>shell</Mono> still
      inject it. Revoking a credential happens at the provider.
    </P>

    <H3>Root, malware, physical access and headless Linux</H3>
    <P>
      Root can read anything on the machine, including your keyring once it is
      unlocked. Malware running as you is the same as any other process running
      as you. Against a stolen laptop, envsec adds no encryption of its own: at
      rest, you rely on the credential store and on full-disk encryption. On a
      Linux server or container without a D-Bus session and a keyring daemon,
      the Secret Service may be missing, and envsec can&apos;t store anything
      there.
    </P>
    <P>
      envsec has no clipboard feature. <Mono>get</Mono> prints to stdout, so the
      value ends up in your scrollback, in any terminal logging you have on, and
      in a screen share.
    </P>

    <H2>What the code does defend against</H2>
    <P>
      Inside that scope, these are the protections I could point to in the
      source:
    </P>
    <List>
      <li>
        <Strong>No shell between envsec and the credential store.</Strong>{" "}
        <Mono>security</Mono>, <Mono>secret-tool</Mono> and{" "}
        <Mono>powershell.exe</Mono> are started with <Mono>execFile</Mono> and
        an argument array, so names and values are never parsed by a shell.
      </li>
      <li>
        <Strong>Allowlisted names.</Strong> A context matches{" "}
        <Mono>^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$</Mono>, is at most
        128 characters, has no path separators and is not one of <Mono>.</Mono>,{" "}
        <Mono>..</Mono>, <Mono>__proto__</Mono>, <Mono>constructor</Mono> or{" "}
        <Mono>prototype</Mono> (
        <Mono>packages/core/src/domain/context-name.ts</Mono>). Each
        dot-separated key segment matches{" "}
        <Mono>^[a-zA-Z0-9][a-zA-Z0-9_-]*$</Mono>, up to 256 characters in total.
      </li>
      <li>
        <Strong>Prepared statements.</Strong> Every query that takes input binds
        it as a parameter.
      </li>
      <li>
        <Strong>PowerShell quoting.</Strong> Values go into single-quoted
        strings with <Mono>&apos;</Mono> doubled and NUL bytes stripped, and
        writes call <Mono>CredWriteW</Mono> directly instead of going through{" "}
        <Mono>cmdkey</Mono>.
      </li>
      <li>
        <Strong>No values in the command text of run.</Strong> As shown above;
        and if any placeholder is missing, the command does not run at all.
      </li>
      <li>
        <Strong>Saved commands keep their context.</Strong> <Mono>cmd run</Mono>{" "}
        ignores <Mono>ENVSEC_CONTEXT</Mono>, so a command saved for one context
        doesn&apos;t silently run against another inside{" "}
        <Mono>envsec shell</Mono>.
      </li>
      <li>
        <Strong>Quiet by default.</Strong> <Mono>list</Mono> and{" "}
        <Mono>search</Mono> print names only, and debug logging never logs the
        arguments, script or stdin passed to the credential store tools.
      </li>
    </List>

    <H2>Recommendations</H2>
    <List>
      <li>
        Turn on full-disk encryption (FileVault, LUKS, BitLocker) and lock your
        screen. That is what protects the keychain at rest.
      </li>
      <li>
        Prefer <Mono>run</Mono> over <Mono>shell</Mono> and <Mono>eval</Mono>,
        and inject into the one command that needs the secrets.
      </li>
      <li>
        Add secrets with the prompt, not <Mono>--value</Mono>. Quote{" "}
        <Mono>{"{key}"}</Mono> placeholders.
      </li>
      <li>
        Keep production in its own context, and don&apos;t load it on a machine
        or in a session where you run code you haven&apos;t read.
      </li>
      <li>
        Treat <Mono>env-file</Mono> output as a secret, delete it when done, and
        run <Mono>envsec audit</Mono> to see what is still on disk.
      </li>
      <li>
        If you use coding agents, read{" "}
        <Link
          className={LINK_CLASS}
          href="/blog/ai-coding-agents-read-your-env"
        >
          Your coding agent can read your .env
        </Link>
        . The short version: envsec stops the accidental reads, not an agent
        that runs commands as you.
      </li>
    </List>
    <P>
      If you find something this post misses, or a claim the code doesn&apos;t
      back,{" "}
      <ExternalLink href="https://github.com/davidnussio/envsec/issues">
        open an issue
      </ExternalLink>
      . A threat model is only useful while it is accurate.
    </P>
  </PostLayout>
);

export default ThreatModelPost;
