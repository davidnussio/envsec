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

const SLUG = "envsec-rescue-plaintext-env-files";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const SCAN_COMMAND = `# Report only: reads files, changes nothing
envsec rescue ~/projects`;

const SCAN_OUTPUT = `◎ Scanning ~/projects…

▸ projects-api  ~/projects/api
    · .env               3 secrets  → projects-api.dev  ▲ committed to git

▸ blog  ~/projects/blog
    · .env               1 secret   → blog.dev

▸ acme-api  ~/projects/clients/acme/api
    · .env               1 secret   → acme-api.dev

▸ globex-api  ~/projects/clients/globex/api
    · .env               1 secret   → globex-api.dev

▸ shop  ~/projects/shop
    · .env               3 secrets  → shop.dev
    · .env.local         1 secret   → shop.dev
    · .env.production    2 secrets  → shop.prod

────────────────────────────────────────
▪ 11 secrets in 7 files · 5 projects · 6 contexts
◆ 1 value appears in more than one place:
    STRIPE_SECRET_KEY ×2  projects-api.dev, shop.dev
▲ 1 file is committed to git: rotate its secrets, removing a file does not erase history
▲ 1 variable with a name envsec cannot store (left in place):
    __INTERNAL_FLAG (~/projects/api/.env)

● Nothing changed. Next:
    envsec rescue /Users/you/projects --import                     move the secrets into the keychain
    envsec rescue /Users/you/projects --import --remove-plaintext  …and delete the .env files`;

const IMPORT_COMMAND = "envsec rescue ~/projects/shop --import";

const IMPORT_OUTPUT = `◎ Scanning ~/projects/shop…

▸ shop  ~/projects/shop
    · .env               3 secrets  → shop.dev
    · .env.local         1 secret   → shop.dev
    · .env.production    2 secrets  → shop.prod

────────────────────────────────────────
▪ 5 secrets in 3 files · 1 project · 2 contexts

▲ 1 secret already in the keychain with a different value (kept; use --import --force to overwrite):
    shop.dev session.secret
■ .env, .env.local, .env.production added to ~/projects/shop/.gitignore

✔ 4 secrets secured · 3 plaintext files left in place
  Delete them once you are ready: envsec rescue /Users/you/projects/shop --remove-plaintext
▶ Next: envsec -c shop.dev run --inject "<your command>"`;

const GITIGNORE_BLOCK = `# Added by envsec rescue: secrets now live in the OS keychain
.env
.env.local
.env.production`;

const CONFLICT_COMMANDS = `# Compare the two values yourself, then keep the right one
envsec -c shop.dev get session.secret
envsec -c shop.dev add session.secret`;

const REMOVE_COMMAND = "envsec rescue ~/projects/shop --remove-plaintext";

const REMOVE_OUTPUT = `✔ 4 secrets secured · 2 plaintext files removed
▲ 1 file kept:
    .env  DATABASE_URL is overridden by .env.local
▶ Next: envsec -c shop.dev run --inject "<your command>"`;

const TRY_IT = `# macOS / Linux (Homebrew), or: npm install -g envsec
brew tap davidnussio/homebrew-tap
brew install envsec

# Point it at the folder where your projects live
envsec rescue ~/projects`;

const RescuePost = () => (
  <PostLayout
    lead={
      <p>
        Every project you have started or cloned in the last few years left a{" "}
        <code>.env</code> file behind. Some left three. They hold database
        passwords, API keys and webhook secrets in plaintext, and most of them
        belong to projects you no longer remember.
      </p>
    }
    slug={SLUG}
  >
    <H2>The files you forgot about</H2>
    <P>
      A <Mono>.env</Mono> file starts as a convenience. Then a project grows a{" "}
      <Mono>.env.local</Mono> for your machine, a <Mono>.env.production</Mono>{" "}
      for the night you debugged prod, and a copy of the Stripe test key you
      pasted from the previous project. Multiply that by every repository in
      your projects folder, including the client work from two years ago.
    </P>
    <P>
      A <Mono>.gitignore</Mono> line keeps those files out of git. It does
      nothing for everything else that reads your disk as you:
    </P>
    <List>
      <li>backups such as Time Machine, which copy dotfiles like any other</li>
      <li>cloud sync, if your projects folder lives inside a synced folder</li>
      <li>a dotfiles repository that grabbed more than you meant it to</li>
      <li>
        <Mono>grep -r</Mono>, editor search, and any script you run in that
        folder
      </li>
      <li>
        coding agents with file access, which I wrote about in{" "}
        <Link
          className={LINK_CLASS}
          href="/blog/ai-coding-agents-read-your-env"
        >
          Your coding agent can read your .env
        </Link>
      </li>
    </List>
    <P>
      I built <Mono>envsec</Mono> to keep secrets in the OS credential store
      instead: the macOS Keychain, the Secret Service on Linux, the Windows
      Credential Manager. Moving one project is a single{" "}
      <Mono>envsec load</Mono>. Moving fifty means first finding them, and that
      is what <Mono>envsec rescue</Mono> does. It shipped in 1.1.2.
    </P>

    <H2>Run the scan first: it changes nothing</H2>
    <TerminalBlock code={SCAN_COMMAND} />
    <P>
      Without flags, <Mono>rescue</Mono> only reads. It doesn&apos;t touch the
      keychain, <Mono>.gitignore</Mono> or any file. The path defaults to the
      current directory. Here is the real output on a test folder with five
      projects:
    </P>
    <CodeBlock code={SCAN_OUTPUT} language="text" />
    <P>
      Each <Mono>.env</Mono> file is listed under its project, with the number
      of secrets in it and the context it would go to. Values are never printed,
      only names and counts.
    </P>

    <H2>What it looks for</H2>
    <H3>Files</H3>
    <P>
      <Mono>rescue</Mono> picks up <Mono>.env</Mono>, <Mono>.env.local</Mono>,{" "}
      <Mono>.env.&lt;mode&gt;</Mono> and <Mono>.env.&lt;mode&gt;.local</Mono>.
      It skips the following:
    </P>
    <List>
      <li>
        templates: <Mono>.env.example</Mono>, <Mono>.env.sample</Mono>,{" "}
        <Mono>.env.template</Mono>, <Mono>.env.dist</Mono>,{" "}
        <Mono>.env.defaults</Mono> and similar suffixes
      </li>
      <li>
        directories that don&apos;t hold your secrets: <Mono>node_modules</Mono>
        , <Mono>.git</Mono>, <Mono>dist</Mono>, <Mono>build</Mono>,{" "}
        <Mono>vendor</Mono>, <Mono>.venv</Mono>, <Mono>.next</Mono>,{" "}
        <Mono>target</Mono> and a few more
      </li>
      <li>symlinks, which are never followed</li>
      <li>
        anything deeper than 8 levels below the starting folder (change it with{" "}
        <Mono>--depth</Mono>)
      </li>
      <li>
        files written by <Mono>envsec env-file</Mono>: their values already live
        in the keychain
      </li>
    </List>
    <P>
      A file larger than 1 MB is reported as unreadable and skipped, since
      nobody writes a dotenv file that size by hand.
    </P>

    <H3>Projects and contexts</H3>
    <P>
      A project is the nearest folder above the file with a <Mono>.git</Mono>,{" "}
      <Mono>package.json</Mono>, <Mono>pyproject.toml</Mono>,{" "}
      <Mono>go.mod</Mono>, <Mono>Cargo.toml</Mono>, <Mono>Gemfile</Mono> or
      another common marker. Its folder name becomes the project name. When two
      projects share a name, both get their parent folder as a prefix, which is
      why the output above shows <Mono>acme-api</Mono> and{" "}
      <Mono>globex-api</Mono>.
    </P>
    <P>
      Each project gets one context per mode, named{" "}
      <Mono>&lt;project&gt;.&lt;mode&gt;</Mono>. <Mono>.env</Mono> and{" "}
      <Mono>.env.local</Mono> map to <Mono>dev</Mono>;{" "}
      <Mono>.env.production</Mono> maps to <Mono>prod</Mono>;{" "}
      <Mono>.env.staging</Mono> stays <Mono>staging</Mono>. Inside a mode, files
      are layered in the order Vite and Next.js use: <Mono>.env</Mono> &lt;{" "}
      <Mono>.env.local</Mono> &lt; <Mono>.env.&lt;mode&gt;</Mono> &lt;{" "}
      <Mono>.env.&lt;mode&gt;.local</Mono>. That is why <Mono>shop.dev</Mono>{" "}
      counts 3 secrets, not 4: the <Mono>DATABASE_URL</Mono> in{" "}
      <Mono>.env.local</Mono> wins over the one in <Mono>.env</Mono>.
    </P>
    <P>
      Names are computed from what that scan sees. Run <Mono>--import</Mono>{" "}
      with the same path you reviewed, or the prefixes can change.
    </P>

    <H2>What the report tells you</H2>
    <List>
      <li>
        <Strong>Reused values.</Strong> The same value in more than one place,
        such as one API key copied into several projects, is reported by
        variable name and context. Values shorter than 8 characters and plain
        numbers are ignored, so ports don&apos;t show up as duplicates.
      </li>
      <li>
        <Strong>Files committed to git.</Strong> For each file,{" "}
        <Mono>rescue</Mono> runs <Mono>git ls-files --error-unmatch</Mono> in
        its folder. A file that git tracks today is flagged, because its secrets
        are in the history and need rotating.
      </li>
      <li>
        <Strong>Names envsec cannot store.</Strong> Variable names map to keys
        like <Mono>load</Mono> does: <Mono>API_TOKEN</Mono> becomes{" "}
        <Mono>api.token</Mono>. A name like <Mono>__INTERNAL_FLAG</Mono> would
        produce empty key segments, so it is listed and left in place.
      </li>
      <li>
        <Strong>Empty variables</Strong> are counted and ignored: there is
        nothing to secure.
      </li>
    </List>
    <P>
      Add <Mono>--json</Mono> (<Mono>envsec --json rescue ~/projects</Mono>) to
      get the same plan as JSON, with key names, file paths and a{" "}
      <Mono>committed</Mono> flag per file.
    </P>

    <H2>Move the secrets: --import</H2>
    <P>
      When the report looks right, add <Mono>--import</Mono> (or <Mono>-i</Mono>
      ). Here it is on the shop project, where I had already stored a newer{" "}
      <Mono>session.secret</Mono> by hand:
    </P>
    <TerminalBlock code={IMPORT_COMMAND} />
    <CodeBlock code={IMPORT_OUTPUT} language="text" />
    <P>For every secret of every context, one of three things happens:</P>
    <List>
      <li>not in the keychain yet: it is stored</li>
      <li>
        already there with the same value: it counts as secured, so running{" "}
        <Mono>rescue</Mono> twice is safe
      </li>
      <li>
        already there with a different value: it is a conflict, and the keychain
        value is kept
      </li>
    </List>
    <P>
      <Mono>--force</Mono> (<Mono>-f</Mono>) overwrites conflicts with the value
      from the files. I&apos;d use it sparingly. It writes whatever the current
      scan sees, so a later run after you&apos;ve removed{" "}
      <Mono>.env.local</Mono> would push the older value from <Mono>.env</Mono>{" "}
      over the one you imported. For a handful of conflicts, decide by hand:
    </P>
    <TerminalBlock code={CONFLICT_COMMANDS} />
    <P>
      <Mono>--import</Mono> also updates <Mono>.gitignore</Mono>. For each file
      inside a git repository that isn&apos;t already ignored, the file name is
      appended to the <Mono>.gitignore</Mono> at the top of that repository,
      under a header, skipping lines that are already there:
    </P>
    <CodeBlock code={GITIGNORE_BLOCK} language="gitignore" />
    <P>
      Pass <Mono>--no-gitignore</Mono> to skip that step. The plaintext files
      themselves stay where they are: <Mono>--import</Mono> never deletes
      anything.
    </P>

    <H2>Delete the plaintext: --remove-plaintext</H2>
    <TerminalBlock code={REMOVE_COMMAND} />
    <CodeBlock code={REMOVE_OUTPUT} language="text" />
    <P>
      A file is deleted only when every value in it is in the keychain exactly
      as written. Right before deleting, <Mono>rescue</Mono> reads each value
      back from the keychain and compares it. Any file that fails a check is
      kept, with the reason printed:
    </P>
    <List>
      <li>a value is not in the keychain yet, or differs from it</li>
      <li>a variable name cannot be stored</li>
      <li>
        a value is overridden by another file, like <Mono>.env</Mono> above:
        only the winning <Mono>DATABASE_URL</Mono> was imported, so the older
        one would be lost
      </li>
      <li>the file cannot be read</li>
    </List>
    <P>
      <Mono>--remove-plaintext</Mono> works on its own when the secrets are
      already imported, as in this second run, or together with{" "}
      <Mono>--import</Mono> in one go.
    </P>

    <H2>What rescue does not do</H2>
    <P>Knowing the edges matters more than the happy path:</P>
    <List>
      <li>
        <Strong>It doesn&apos;t touch git history.</Strong> No rewrite, no{" "}
        <Mono>git rm</Mono>, no commit. A deleted file that git tracked shows up
        as deleted in <Mono>git status</Mono>, and you commit that yourself. The
        old commits still contain the secrets.
      </li>
      <li>
        <Strong>It doesn&apos;t search the history.</Strong> The git check
        covers files tracked today. A <Mono>.env</Mono> committed once and
        removed later is not flagged.
      </li>
      <li>
        <Strong>It doesn&apos;t rotate anything.</Strong> A key that was
        committed or copied around is still valid until you revoke it with the
        provider.
      </li>
      <li>
        <Strong>It doesn&apos;t reach copies.</Strong> Backups, snapshots and
        synced copies made before today still contain the files. Deleting is a
        plain file removal, not a secure wipe.
      </li>
      <li>
        <Strong>It only knows dotenv files.</Strong> Secrets in{" "}
        <Mono>config.json</Mono>, shell profiles or a tool&apos;s credentials
        file are out of scope.
      </li>
      <li>
        <Strong>It doesn&apos;t change how your app starts.</Strong> Once the
        file is gone, the app needs the values from somewhere:{" "}
        <Mono>envsec -c shop.dev run --inject &quot;npm run dev&quot;</Mono>{" "}
        passes them as environment variables. The full walkthrough is in{" "}
        <Link
          className={LINK_CLASS}
          href="/blog/migrate-from-dotenv-to-keychain"
        >
          From .env to the keychain in five minutes
        </Link>
        .
      </li>
    </List>

    <H2>Flags</H2>
    <List>
      <li>
        <Mono>&lt;path&gt;</Mono>: folder to scan recursively (default{" "}
        <Mono>.</Mono>)
      </li>
      <li>
        <Mono>--import</Mono>, <Mono>-i</Mono>: store the secrets in the
        keychain; without it, <Mono>rescue</Mono> only reports
      </li>
      <li>
        <Mono>--force</Mono>, <Mono>-f</Mono>: with <Mono>--import</Mono>,
        overwrite keychain values that differ
      </li>
      <li>
        <Mono>--remove-plaintext</Mono>: delete each file whose values are all
        verified in the keychain
      </li>
      <li>
        <Mono>--no-gitignore</Mono>: don&apos;t append to{" "}
        <Mono>.gitignore</Mono> (it&apos;s on by default with{" "}
        <Mono>--import</Mono> or <Mono>--remove-plaintext</Mono>)
      </li>
      <li>
        <Mono>--depth</Mono>: how many folder levels to descend (default 8)
      </li>
      <li>
        <Mono>--json</Mono>: machine-readable output (a global flag)
      </li>
    </List>

    <H2>Try it on your own folder</H2>
    <TerminalBlock code={TRY_IT} />
    <P>
      The scan is read-only, so the worst case is a number you&apos;d rather not
      have seen. If it finds files committed to git, rotate those keys first.
      Then import, check that your apps still start, and remove the plaintext.
      The command reference is in the{" "}
      <Link className={LINK_CLASS} href="/docs#rescue">
        docs
      </Link>
      , and the source is on{" "}
      <ExternalLink href="https://github.com/davidnussio/envsec">
        GitHub
      </ExternalLink>
      .
    </P>
  </PostLayout>
);

export default RescuePost;
