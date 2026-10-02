import Link from "next/link";

import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  DataTable,
  ExternalLink,
  H2,
  List,
  Mono,
  OrderedList,
  P,
  Strong,
} from "@/components/blog/prose";
import { CodeBlock } from "@/components/code-block";
import { TerminalBlock } from "@/components/terminal-block";

const SLUG = "ai-coding-agents-read-your-env";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const MIGRATE_COMMANDS = `# Find plaintext .env files under the current directory (report only)
envsec rescue
# Import one file into a context, then delete the file
envsec -c myapp.dev load --input .env
rm .env
# Start the app with every secret of the context in its environment
envsec -c myapp.dev run --inject 'npm run dev'
# Or reference a single secret in the command
envsec -c myapp.dev run 'psql "{database.url}"'`;

const CLEAN_SHELL_COMMANDS = `# envsec shell sets this variable in the shell it starts
echo $ENVSEC_CONTEXT
# Undo an earlier eval of envsec env in bash or zsh
eval "$(envsec -c myapp.dev env --unset)"`;

const CLAUDE_ASK_RULES = `{
  "permissions": {
    "ask": [
      "Bash(envsec get *)",
      "Bash(envsec env *)",
      "Bash(envsec env-file *)",
      "Bash(envsec share *)"
    ]
  }
}`;

const EXPIRES_COMMAND = `envsec -c myapp.dev add stripe.key --expires 30d
# Later: list expired and soon-to-expire secrets
envsec audit`;

const COMPARISON_COLUMNS = [
  { label: "" },
  { label: "Plaintext .env" },
  { highlight: true, label: "envsec" },
] as const;

const COMPARISON_ROWS = [
  ["Agent opens or greps the file", "exposed", "nothing to read"],
  ["Editor indexes the workspace", "exposed", "nothing to index"],
  ["Agent runs git add -A", "committed", "nothing to commit"],
  ["Agent runs a command that prints it", "exposed", "exposed"],
  ["Agent runs in a shell with secrets loaded", "exposed", "exposed"],
] as const;

const AiCodingAgentsPost = () => (
  <PostLayout
    lead={
      <p>
        You open a repository, start a coding agent and ask it to fix a failing
        integration test. To do that, it reads files and runs commands with your
        user account. If a <Mono>.env</Mono> file sits next to{" "}
        <Mono>package.json</Mono>, it is within reach, and nothing about that
        requires the agent to misbehave.
      </p>
    }
    slug={SLUG}
  >
    <H2>What an agent actually touches</H2>
    <P>
      Claude Code, Cursor&apos;s agent, GitHub Copilot&apos;s agent mode and
      Codex all work in roughly the same way. They read and search the files in
      your workspace, and they run shell commands as you. Whatever those reads
      and commands return becomes part of the conversation: it is sent to the
      model and, depending on the tool, saved in a session transcript on disk.
    </P>
    <P>
      That is the point of an agent. It also means a plaintext secrets file in
      the project is one tool call away from leaving your machine.
    </P>

    <H2>Four ordinary ways a .env gets read</H2>
    <P>
      None of these needs a malicious model or a prompt injection. They are the
      agent doing what you asked:
    </P>
    <OrderedList>
      <li>
        <Strong>Debugging a config error.</Strong> The database connection
        fails, so the agent opens <Mono>.env</Mono> to check{" "}
        <Mono>DATABASE_URL</Mono>. Every line of the file is now in the context,
        not just the one it needed.
      </li>
      <li>
        <Strong>Searching.</Strong> A recursive grep for a variable name matches{" "}
        <Mono>.env</Mono> too, and prints the matching line with its value.
      </li>
      <li>
        <Strong>Printing state.</Strong> To diagnose a failure, the agent runs{" "}
        <Mono>printenv</Mono> or a command that dumps the resolved
        configuration. The output lands in the transcript.
      </li>
      <li>
        <Strong>Committing.</Strong> <Mono>git add -A</Mono> and a commit, in a
        repository where <Mono>.env</Mono> was never ignored, put the file in
        history. It stays there after you delete it.
      </li>
    </OrderedList>
    <P>
      Each one is a small accident. Over weeks of agent sessions, the realistic
      assumption is that a plaintext <Mono>.env</Mono> in the workspace gets
      read at some point.
    </P>

    <H2>Ignore files and deny rules help, within limits</H2>
    <P>
      Agents have settings to keep files out of reach. Claude Code supports
      permission deny rules such as <Mono>Read(./.env)</Mono>, and Cursor reads
      a <Mono>.cursorignore</Mono> file. Both are worth setting up. Both vendors
      also document where they stop:
    </P>
    <List>
      <li>
        The{" "}
        <ExternalLink href="https://code.claude.com/docs/en/permissions">
          Claude Code permissions docs
        </ExternalLink>{" "}
        say that <Mono>Read</Mono> deny rules cover its built-in file tools and
        the file commands it recognizes in Bash, such as <Mono>cat</Mono>, but
        not a script or other subprocess that opens the file by itself. They
        also say a Bash rule matches the command text, so it is not a security
        boundary around a program.
      </li>
      <li>
        The{" "}
        <ExternalLink href="https://cursor.com/docs/context/ignore-files">
          Cursor ignore-files docs
        </ExternalLink>{" "}
        say the terminal and MCP tools used by the agent can&apos;t block access
        to files listed in <Mono>.cursorignore</Mono>.
      </li>
    </List>
    <P>
      That is an honest description of the problem. Once an agent can run a
      shell, a file on disk is readable by some path. The more reliable fix is
      to not have the file.
    </P>

    <H2>Take the file away</H2>
    <P>
      envsec stores each value in the credential store your OS already has: the
      macOS Keychain, the Secret Service on Linux (through{" "}
      <Mono>secret-tool</Mono>), or Windows Credential Manager. A small SQLite
      database keeps key names and timestamps, never values. Moving a project
      over looks like this:
    </P>
    <TerminalBlock code={MIGRATE_COMMANDS} />
    <P>
      <Mono>load</Mono> turns <Mono>DATABASE_URL</Mono> into the key{" "}
      <Mono>database.url</Mono>, and <Mono>run --inject</Mono> turns it back
      into <Mono>DATABASE_URL</Mono> in the environment of that one process. A{" "}
      <Mono>{"{key}"}</Mono> placeholder works without <Mono>--inject</Mono>:
      envsec passes the value in an environment variable and rewrites the
      placeholder into a reference to it, so the value never appears in the
      command text. When the process exits, the values go with it.
    </P>
    <P>
      There is no file for the agent to open while debugging, nothing for a grep
      to match, nothing to index and nothing to commit. If you have many
      projects, the{" "}
      <Link
        className={LINK_CLASS}
        href="/blog/envsec-rescue-plaintext-env-files"
      >
        rescue post
      </Link>{" "}
      covers finding and importing every <Mono>.env</Mono> in a directory tree
      in one pass.
    </P>

    <H2>What envsec does not stop</H2>
    <P>
      This part matters more than the rest. An agent that runs shell commands
      runs them as you, and envsec is a program you are allowed to run. So:
    </P>
    <List>
      <li>
        It can run <Mono>envsec -c myapp.dev get database.url</Mono>, and the
        value prints. On macOS, envsec writes and reads Keychain items through
        Apple&apos;s <Mono>security</Mono> tool, whose help text says the
        application that creates an item is trusted to read it without a
        warning; in my tests, reads raise no dialog. On Linux, a keyring that
        was unlocked at login typically answers any process in your session.
        Windows Credential Manager is readable by processes running as you.
      </li>
      <li>
        If you start the agent inside <Mono>envsec shell</Mono>, or in a
        terminal where you ran <Mono>eval &quot;$(envsec env)&quot;</Mono>, the
        secrets are in the agent&apos;s own environment. Every command it runs
        inherits them, and <Mono>env</Mono> prints them all.
      </li>
      <li>
        A process started with <Mono>envsec run --inject</Mono> can print its
        own environment, and so can a test that fails with a dump of{" "}
        <Mono>process.env</Mono>.
      </li>
    </List>
    <DataTable
      caption="What changes when the values move from a file to the OS credential store."
      columns={COMPARISON_COLUMNS}
      rows={COMPARISON_ROWS}
    />
    <P>
      envsec removes the accidental paths: the file read while debugging, the
      grep hit, the indexed file, the commit. It does not defend against an
      agent that has been told to fetch your secrets, whether by you or by a
      prompt injection hidden in a README or an issue. Nothing that runs as your
      user can fully do that. The{" "}
      <Link className={LINK_CLASS} href="/blog/envsec-threat-model">
        envsec threat model
      </Link>{" "}
      goes through each of these limits in detail.
    </P>

    <H2>A setup that holds up</H2>
    <P>
      This is what I do, and what I would suggest to anyone using an agent on a
      project with real credentials:
    </P>
    <OrderedList>
      <li>
        <Strong>Start agents from a clean shell.</Strong> Not inside{" "}
        <Mono>envsec shell</Mono>, and not after{" "}
        <Mono>eval &quot;$(envsec env)&quot;</Mono>. Use <Mono>envsec run</Mono>{" "}
        for the commands that need secrets, so they live only as long as that
        process.
      </li>
      <li>
        <Strong>Read commands before approving them.</Strong> If you have
        allowed most commands to run without asking, add ask rules for the
        envsec commands that print or write values. In Claude Code, that is a
        few lines in <Mono>settings.json</Mono>. Since these rules match the
        command text, treat them as a prompt, not a wall.
      </li>
      <li>
        <Strong>Give the agent a dev context.</Strong> Contexts are names like{" "}
        <Mono>myapp.dev</Mono> and <Mono>myapp.prod</Mono>. They are not access
        control, but they decide what <Mono>--inject</Mono> loads. Keep
        production values in a context you never use in an agent session.
      </li>
      <li>
        <Strong>Use test or narrowly scoped keys, and date them.</Strong> Store
        them with <Mono>--expires</Mono>. Expiry is a reminder, not a lock:{" "}
        <Mono>get</Mono> warns about an expired secret and{" "}
        <Mono>envsec audit</Mono> lists it, but the value stays readable until
        you rotate it at the provider.
      </li>
      <li>
        <Strong>Look at OS-level sandboxing.</Strong> Claude Code has a{" "}
        <ExternalLink href="https://code.claude.com/docs/en/sandboxing">
          sandbox mode
        </ExternalLink>{" "}
        that restricts the filesystem and network access of the commands it
        runs. I have not tested it against keychain access, so check what it
        allows before relying on it for this.
      </li>
      <li>
        <Strong>Rotate anything that reached a transcript.</Strong> Deleting the
        conversation afterwards does not undo what was already sent to the
        model.
      </li>
    </OrderedList>
    <P>
      To check where you are and clean up an earlier <Mono>eval</Mono>:
    </P>
    <TerminalBlock code={CLEAN_SHELL_COMMANDS} />
    <P>
      The ask rules for Claude Code, in <Mono>.claude/settings.json</Mono> or{" "}
      <Mono>~/.claude/settings.json</Mono>:
    </P>
    <CodeBlock code={CLAUDE_ASK_RULES} language="json" />
    <P>And a key with a rotation date:</P>
    <TerminalBlock code={EXPIRES_COMMAND} />

    <H2>In short</H2>
    <P>
      A plaintext <Mono>.env</Mono> next to a coding agent is a file that will
      be read sooner or later, through ordinary work. Moving the values into the
      OS credential store removes those accidental paths. It does not make an
      agent with a shell trustworthy: for that you still need approvals, scoped
      credentials and rotation. Start with <Mono>envsec rescue</Mono> to see
      what is on disk, check the{" "}
      <Link className={LINK_CLASS} href="/docs">
        docs
      </Link>{" "}
      for the full command list, and read the threat model before deciding how
      much to rely on it.
    </P>
  </PostLayout>
);

export default AiCodingAgentsPost;
