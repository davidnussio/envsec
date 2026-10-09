import Link from "next/link";

import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  ExternalLink,
  H2,
  H3,
  List,
  Mono,
  P,
  Strong,
} from "@/components/blog/prose";
import { CodeBlock } from "@/components/code-block";
import { TerminalBlock } from "@/components/terminal-block";

const SLUG = "migrate-from-dotenv-to-keychain";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const DOTENV_FILE = `# Database
DATABASE_URL="postgres://app:s3cret@localhost:5432/myapp"
STRIPE_SECRET_KEY=sk_test_example_not_real
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXTAUTH_SECRET='a-long-random-string'`;

const DOTENV_USAGE = `# Plain Node with dotenv
node -r dotenv/config server.js

# Next.js reads .env* files by itself
npm run dev`;

const INSTALL = `# macOS / Linux
brew tap davidnussio/homebrew-tap
brew install envsec

# or, with Node.js 22.13+
npm install -g envsec`;

const LOAD_COMMAND = `cd ~/projects/myapp
envsec -c myapp.dev load`;

const LOAD_OUTPUT = "✔ Done: 4 added, 0 overwritten, 0 skipped";

const RELOAD_OUTPUT = `▲ Skipped "database.url": already exists (use --force to overwrite)
▲ Skipped "stripe.secret.key": already exists (use --force to overwrite)
▲ Skipped "next.public.site.url": already exists (use --force to overwrite)
▲ Skipped "nextauth.secret": already exists (use --force to overwrite)
✔ Done: 0 added, 0 overwritten, 4 skipped`;

const LOAD_LOCAL = `# .env.local overrides .env, so let it win
envsec -c myapp.dev load --input .env.local --force`;

const VERIFY_COMMANDS = `envsec -c myapp.dev list
envsec -c myapp.dev get stripe.secret.key`;

const LIST_OUTPUT = `◆ database.url  updated: 2026-10-09 12:21:22
◆ next.public.site.url  updated: 2026-10-09 12:21:22
◆ nextauth.secret  updated: 2026-10-09 12:21:22
◆ stripe.secret.key  updated: 2026-10-09 12:21:22

▪ 4 secrets in myapp.dev`;

const RUN_COMMANDS = `# Next.js
envsec -c myapp.dev run --inject 'npm run dev'

# Plain Node: drop -r dotenv/config
envsec -c myapp.dev run --inject 'node server.js'`;

const MOVE_ASIDE = `# Move .env (and .env.local, if you have one) out of the project
mkdir -p ~/env-backup/myapp
mv .env ~/env-backup/myapp/
envsec -c myapp.dev run --inject 'npm run dev'`;

const PLACEHOLDER_COMMAND = "envsec -c myapp.dev run 'psql {database.url}'";

const SAVE_COMMANDS = `# Saves the command, then runs it
envsec -c myapp.dev run --save --name dev --inject 'npm run dev'

# From now on
envsec cmd run dev --inject`;

const CMD_LIST_OUTPUT = "› dev  →  npm run dev  (ctx: myapp.dev)";

const SHELL_COMMAND = "envsec -c myapp.dev shell";

const SHELL_OUTPUT = `▶ envsec shell — context: myapp.dev (4 secrets loaded)
Type 'exit' or press Ctrl+D to leave the session.`;

const SDK_INSTALL = "npm install @envsec/sdk";

const SDK_LOAD = `import { loadSecrets } from "@envsec/sdk";

// Sets process.env.DATABASE_URL, STRIPE_SECRET_KEY, …
await loadSecrets({ context: "myapp.dev", inject: true });`;

const SDK_CLIENT = `import { EnvsecClient } from "@envsec/sdk";

const client = await EnvsecClient.create({ context: "myapp.dev" });
try {
  // Keys use the dotted form, not the env var name
  const databaseUrl = await client.require("database.url");
  await seedDatabase(databaseUrl);
} finally {
  await client.close();
}`;

const SHARE_COMMANDS = `# You: encrypt the context for a teammate's GPG key
envsec -c myapp.dev share --encrypt-to alice@example.com -o myapp.dev.asc

# Alice: decrypt straight into her own keychain
gpg --decrypt myapp.dev.asc | envsec -c myapp.dev load --input /dev/stdin`;

const ENV_FILE_COMMANDS = `envsec -c myapp.dev env-file --output .env
docker compose up
rm .env

# Lists generated files that still exist, forgets deleted ones
envsec audit`;

const DELETE_COMMANDS = `# The folder is named myapp, so rescue checks the files against myapp.dev
envsec rescue ~/env-backup/myapp --remove-plaintext`;

const MigratePost = () => (
  <PostLayout
    lead={
      <p>
        Your app reads its configuration from <code>process.env</code>, and a
        plaintext <code>.env</code> file fills it in. That file is readable by
        every process running as you, and it gets copied wherever your project
        folder goes. Here is how I move a typical Node or Next.js project off
        it, one command at a time.
      </p>
    }
    slug={SLUG}
  >
    <H2>The setup you have today</H2>
    <P>A project like this one:</P>
    <CodeBlock code={DOTENV_FILE} language="bash" />
    <P>
      Something loads it at startup: the{" "}
      <ExternalLink href="https://github.com/motdotla/dotenv">
        dotenv
      </ExternalLink>{" "}
      package, Node&apos;s own <Mono>--env-file</Mono> flag, or{" "}
      <ExternalLink href="https://nextjs.org/docs/app/guides/environment-variables">
        Next.js, which reads <code>.env*</code> files on its own
      </ExternalLink>
      .
    </P>
    <CodeBlock code={DOTENV_USAGE} language="bash" />
    <P>
      The goal: keep <Mono>process.env</Mono> exactly as your code expects it,
      but fill it from the OS credential store instead of a file. Your
      application code doesn&apos;t change.
    </P>

    <H2>1. Install envsec</H2>
    <TerminalBlock code={INSTALL} />
    <P>
      On macOS envsec uses the Keychain and needs nothing else. On Linux it
      talks to the Secret Service through <Mono>secret-tool</Mono> (package{" "}
      <Mono>libsecret-tools</Mono> on Debian and Ubuntu), with a keyring daemon
      such as GNOME Keyring running. On Windows it uses the Credential Manager.
      The Homebrew formula installs a standalone binary, so it doesn&apos;t need
      Node.js.
    </P>

    <H2>2. Load the .env into a context</H2>
    <P>
      A context is a named group of secrets. I use{" "}
      <Mono>&lt;project&gt;.&lt;environment&gt;</Mono>, so{" "}
      <Mono>myapp.dev</Mono> here. <Mono>load</Mono> reads <Mono>.env</Mono>{" "}
      from the current folder by default:
    </P>
    <TerminalBlock code={LOAD_COMMAND} />
    <CodeBlock code={LOAD_OUTPUT} language="text" />
    <P>
      Variable names become dotted, lowercase keys:{" "}
      <Mono>STRIPE_SECRET_KEY</Mono> is stored as <Mono>stripe.secret.key</Mono>
      . Quotes, <Mono>export</Mono> prefixes, inline comments and multi-line
      quoted values are handled the way dotenv files usually write them.
    </P>
    <P>
      <Mono>load</Mono> never overwrites silently. Run it a second time and
      every key that already exists is skipped:
    </P>
    <CodeBlock code={RELOAD_OUTPUT} language="text" />
    <P>
      <Mono>--force</Mono> (<Mono>-f</Mono>) overwrites. That is what you want
      for a <Mono>.env.local</Mono> that overrides <Mono>.env</Mono>:
    </P>
    <TerminalBlock code={LOAD_LOCAL} />
    <H3>Three things to check in your file</H3>
    <List>
      <li>
        <Strong>Case.</Strong> Keys are lowercased, and <Mono>--inject</Mono>{" "}
        turns them back into upper-case names. A variable written as{" "}
        <Mono>apiKey</Mono> comes back as <Mono>APIKEY</Mono>.
      </li>
      <li>
        <Strong>Names that don&apos;t map.</Strong> A name like{" "}
        <Mono>MY__VAR</Mono> or <Mono>_PRIVATE</Mono> would produce an empty key
        segment. <Mono>load</Mono> stops with an error at that line, so rename
        it first.
      </li>
      <li>
        <Strong>References.</Strong> envsec stores values literally. A value
        such as <Mono>$OTHER_VAR</Mono>, which Next.js or dotenv-expand would
        expand, is stored as the text <Mono>$OTHER_VAR</Mono>.
      </li>
    </List>

    <H2>3. Check what landed</H2>
    <TerminalBlock code={VERIFY_COMMANDS} />
    <CodeBlock code={LIST_OUTPUT} language="text" />
    <P>
      <Mono>list</Mono> shows key names and timestamps, never values.{" "}
      <Mono>get</Mono> prints one value, so use it when you actually need to see
      one.
    </P>

    <H2>4. Start the app with envsec run</H2>
    <TerminalBlock code={RUN_COMMANDS} />
    <P>
      <Mono>--inject</Mono> (<Mono>-i</Mono>) reads every secret in the context,
      turns each key back into an environment variable name (
      <Mono>stripe.secret.key</Mono> → <Mono>STRIPE_SECRET_KEY</Mono>) and runs
      the command through <Mono>/bin/sh</Mono> with those variables added to its
      environment. On Windows the shell is <Mono>cmd.exe</Mono>. Nothing is
      written to disk.
    </P>
    <P>
      For Next.js, values already in <Mono>process.env</Mono> take precedence
      over <Mono>.env*</Mono> files. That means envsec wins, but a variable you
      forgot to import would still come from the file, and the app would look
      fine. Move the files aside before you test:
    </P>
    <TerminalBlock code={MOVE_ASIDE} />
    <P>
      If the app starts and works, every value it needs is in the keychain. You
      can now remove <Mono>dotenv</Mono> and the <Mono>-r dotenv/config</Mono>{" "}
      flag from your scripts.
    </P>
    <H3>Placeholders for one-off commands</H3>
    <P>
      Without <Mono>--inject</Mono>, <Mono>run</Mono> resolves{" "}
      <Mono>{"{key}"}</Mono> placeholders instead:
    </P>
    <TerminalBlock code={PLACEHOLDER_COMMAND} />
    <P>
      envsec doesn&apos;t paste the value into the command line. It replaces the
      placeholder with a reference to a temporary environment variable (
      <Mono>$ENVSEC_0_DATABASE_URL</Mono>) and lets the shell expand it, so the
      value stays out of your shell history. If a placeholder names a key that
      doesn&apos;t exist, the command doesn&apos;t run at all.
    </P>

    <H2>5. Save it as a command</H2>
    <P>
      Typing the context every time gets old. <Mono>--save</Mono> stores the
      command under a name, together with its context:
    </P>
    <TerminalBlock code={SAVE_COMMANDS} />
    <CodeBlock code={CMD_LIST_OUTPUT} language="text" />
    <P>
      That line is what <Mono>envsec cmd list</Mono> prints. Note the{" "}
      <Mono>--inject</Mono> on <Mono>cmd run</Mono>: the saved entry keeps the
      command string and the context, not the flag. A saved command always runs
      in the context it was saved with, unless you pass <Mono>-c</Mono>{" "}
      explicitly.
    </P>

    <H2>6. Or open a shell with the secrets loaded</H2>
    <P>
      When you&apos;re going to run several commands, start a subshell with the
      whole context in its environment:
    </P>
    <TerminalBlock code={SHELL_COMMAND} />
    <CodeBlock code={SHELL_OUTPUT} language="text" />
    <P>
      <Mono>ENVSEC_CONTEXT</Mono> is set inside the session, and bash and zsh
      get an <Mono>(envsec:myapp.dev)</Mono> prefix in the prompt. For those two
      shells envsec skips your startup files (<Mono>--norc</Mono>,{" "}
      <Mono>--no-rcs</Mono>), so aliases from <Mono>.bashrc</Mono> or{" "}
      <Mono>.zshrc</Mono> won&apos;t be there. When you <Mono>exit</Mono>, the
      variables go away with the process. <Mono>--no-inherit</Mono> starts the
      shell with only <Mono>PATH</Mono> and the secrets.
    </P>

    <H2>7. Optional: read secrets from code</H2>
    <P>
      For scripts that run outside your dev server, such as a seed script,{" "}
      <Mono>@envsec/sdk</Mono> reads the same contexts. It needs Node.js 22.13
      or later, or Bun.
    </P>
    <TerminalBlock code={SDK_INSTALL} />
    <CodeBlock code={SDK_LOAD} language="ts" />
    <P>
      <Mono>loadSecrets</Mono> returns the secrets as an object keyed by the
      dotted names; <Mono>inject: true</Mono> also copies them into{" "}
      <Mono>process.env</Mono>. For more than one read, the client:
    </P>
    <CodeBlock code={SDK_CLIENT} language="ts" />
    <P>
      I keep the SDK out of application code. An app that reads{" "}
      <Mono>process.env</Mono> runs anywhere, with any source of variables. An
      app that imports the SDK needs a working keychain wherever it runs.
    </P>

    <H2>Teammates</H2>
    <P>
      Each developer has their own keychain, so nothing syncs. To hand a
      teammate the values once, encrypt them for their GPG key:
    </P>
    <TerminalBlock code={SHARE_COMMANDS} />
    <P>
      The payload uses the same <Mono>KEY=&quot;value&quot;</Mono> format that{" "}
      <Mono>load</Mono> reads, and the pipe keeps the decrypted text off the
      disk (<Mono>/dev/stdin</Mono> works on macOS and Linux). The details,
      including what GPG does and doesn&apos;t protect, are in{" "}
      <Link className={LINK_CLASS} href="/blog/sharing-secrets-with-gpg">
        Sharing secrets with GPG
      </Link>
      .
    </P>

    <H2>CI and servers</H2>
    <P>
      envsec is built for developer machines, and I don&apos;t recommend it in
      CI. On Linux it needs a D-Bus session and an unlocked keyring daemon.
      envsec&apos;s own end-to-end tests start both under{" "}
      <Mono>dbus-launch</Mono> on Ubuntu runners, which shows it can work, but
      that is a test rig, not a deployment pattern.
    </P>
    <P>
      In CI, use your provider&apos;s secret store and let it set the
      environment variables. Because the app still reads{" "}
      <Mono>process.env</Mono>, nothing changes in your code: locally the values
      come from <Mono>envsec run --inject</Mono>, in CI from the pipeline.
    </P>

    <H2>When a tool insists on a file</H2>
    <P>
      Some tools only read files, such as a Docker Compose <Mono>env_file</Mono>
      . For those, write a temporary one:
    </P>
    <TerminalBlock code={ENV_FILE_COMMANDS} />
    <P>
      <Mono>env-file</Mono> writes plaintext, so treat the result like the file
      you are getting rid of. envsec records where it wrote it:{" "}
      <Mono>envsec audit</Mono> lists generated files that still exist and drops
      the records of deleted ones, and <Mono>envsec rescue</Mono> skips them
      because their values are already in the keychain.
    </P>

    <H2>8. Delete the old .env</H2>
    <P>
      Once the app runs from the keychain, remove the copies you moved aside.
      Instead of <Mono>rm</Mono>, let envsec check them first:
    </P>
    <TerminalBlock code={DELETE_COMMANDS} />
    <P>
      <Mono>rescue</Mono> deletes a file only after reading every value back
      from the keychain and finding it unchanged. Otherwise it keeps the file
      and prints why: a value missing from <Mono>myapp.dev</Mono>, or a value in{" "}
      <Mono>.env</Mono> overridden by <Mono>.env.local</Mono>. More on that in{" "}
      <Link
        className={LINK_CLASS}
        href="/blog/envsec-rescue-plaintext-env-files"
      >
        the rescue post
      </Link>
      . If the <Mono>.env</Mono> was ever committed to git, deleting it now
      doesn&apos;t remove it from the history: rotate those keys.
    </P>

    <H2>In short</H2>
    <List>
      <li>
        <Mono>envsec -c myapp.dev load</Mono> moves the file into the keychain
        and skips keys that already exist
      </li>
      <li>
        <Mono>envsec -c myapp.dev run --inject &apos;npm run dev&apos;</Mono>{" "}
        replaces dotenv; test it with the files moved aside
      </li>
      <li>
        <Mono>cmd</Mono> and <Mono>shell</Mono> save you from retyping the
        context
      </li>
      <li>CI keeps using its own secret store</li>
      <li>delete the file last, after the app has run without it</li>
    </List>
    <P>
      Every command above is in the{" "}
      <Link className={LINK_CLASS} href="/docs">
        docs
      </Link>
      , and{" "}
      <Link className={LINK_CLASS} href="/compare">
        the comparison page
      </Link>{" "}
      puts envsec next to dotenv and the alternatives.
    </P>
  </PostLayout>
);

export default MigratePost;
