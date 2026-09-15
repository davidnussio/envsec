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
import { CodeBlock } from "@/components/code-block";
import { TerminalBlock } from "@/components/terminal-block";

const SLUG = "keychain-for-values-sqlite-for-metadata";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const SCHEMA = `CREATE TABLE IF NOT EXISTS secrets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  env TEXT NOT NULL,              -- the context
  key TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT DEFAULT NULL,   -- added later with ALTER TABLE
  UNIQUE(env, key)
);

CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  command TEXT NOT NULL,
  context TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS env_exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_env_exports_path
  ON env_exports(path);`;

const QUERIES = `// envsec list -c myapp.dev
queryAll(
  SecretListRow,
  "SELECT key, updated_at, expires_at FROM secrets WHERE env = ? ORDER BY key",
  [env]
);

// envsec audit: everything that expires before the cutoff
queryAll(
  ExpiringSecretRow,
  "SELECT env, key, created_at, updated_at, expires_at FROM secrets " +
    "WHERE expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at",
  [cutoff]
);`;

const DB_PATH = `# default
envsec -c myapp.dev list
# one-off, the flag wins over the variable
envsec --db ~/scratch/envsec/store.sqlite -c myapp.dev list
# for a whole shell session or a CI job
export ENVSEC_DB=/tmp/ci-envsec/store.sqlite`;

const INIT_DB = `mkdirSync(dbDir, { mode: DIR_PERMISSIONS, recursive: true }); // 0o700
chmodSync(dbDir, DIR_PERMISSIONS);
// Create the file ourselves so it never exists with the default umask
// permissions; SQLite gives its journal files the same mode.
closeSync(openSync(dbPath, "a", FILE_PERMISSIONS)); // 0o600
chmodSync(dbPath, FILE_PERMISSIONS);

const { DatabaseSync } = await loadSqlite();
const db = new DatabaseSync(dbPath);
db.exec(\`PRAGMA busy_timeout = \${BUSY_TIMEOUT_MS}\`); // 5000`;

const SQLJS_PERSIST = `const persist = (db: Database, dbPath: string) => {
  writeFileSync(dbPath, Buffer.from(db.export()), { mode: FILE_PERMISSIONS });
};`;

const SET_FLOW = `// When overwriting, keep the previous value so a failed metadata write
// can restore it instead of deleting the user's existing secret.
const exists = yield* metadata.get(context, key).pipe(
  Effect.as(true),
  Effect.catchTag("SecretNotFoundError", () => Effect.succeed(false))
);
const previous = exists
  ? yield* keychain.get(parsed.service, parsed.account) /* … */
  : Option.none<string>();
yield* keychain.set(parsed.service, parsed.account, encodeValue(value));
yield* metadata.upsert(context, key, expiresAt).pipe(
  Effect.catch((metadataError) =>
    Option.match(previous, {
      onNone: () => keychain.remove(parsed.service, parsed.account),
      onSome: (raw) => keychain.set(parsed.service, parsed.account, raw),
    }).pipe(Effect.ignore, Effect.andThen(Effect.fail(metadataError)))
  )
);`;

const ORPHAN_SESSION = `# remove the value behind envsec's back
$ security delete-generic-password -s envsec.blogdemo.dev.api -a token
password has been deleted.
$ envsec -c blogdemo.dev get api.token
▲ Secret "api.token" has metadata but is missing from the OS keychain.
● To clean up stale metadata, run: envsec delete -c blogdemo.dev api.token
✖ Secret "api.token" has metadata in context "blogdemo.dev" but is missing from the OS keychain. Run: envsec delete -c blogdemo.dev api.token
$ envsec -c blogdemo.dev delete api.token --yes
× Secret "api.token" removed from context "blogdemo.dev"`;

const FAILURE_COLUMNS = [
  { label: "What goes wrong" },
  { label: "What envsec does" },
  { label: "What can be left behind" },
] as const;

const FAILURE_ROWS = [
  [
    "add: the metadata write fails",
    "restores the previous value, or removes the new item",
    "nothing, unless the rollback fails too",
  ],
  [
    "add: killed between the two writes",
    "nothing; no transaction spans both",
    "a keychain item with no row",
  ],
  [
    "delete: the keychain removal fails",
    "ignores the error and deletes the row",
    "a keychain item with no row",
  ],
  [
    "item deleted outside envsec",
    "get explains and suggests envsec delete",
    "a row with no item, until you delete it",
  ],
  [
    "a batch fails halfway",
    "commits the rows written so far",
    "nothing new: rows match the work that finished",
  ],
] as const;

const KeychainForValuesPost = () => (
  <PostLayout
    lead={
      <p>
        The OS keychain is a good place to put a secret value. It is a poor
        place to ask questions: which secrets does this project have, which ones
        expire next week, where did I write a <Mono>.env</Mono> file last month.
        A secrets CLI needs both, and no single store does both well.
      </p>
    }
    slug={SLUG}
  >
    <P>
      envsec splits the job. Secret values go into the OS credential store
      (macOS Keychain, the Secret Service on Linux, Windows Credential Manager).
      Everything else, from key names to expiry dates, goes into a small SQLite
      database. This post explains why, what is in that database, and what
      happens when one of the two writes fails and the other doesn&apos;t.
    </P>

    <H2>What keychains are bad at</H2>
    <P>
      All three stores answer one question well: &quot;give me the item with
      this exact name&quot;. Beyond that, each one is different:
    </P>
    <List>
      <li>
        <Strong>macOS.</Strong> <Mono>security find-generic-password</Mono>{" "}
        returns one item, the first that matches. To enumerate items you would
        run <Mono>security dump-keychain</Mono> and parse the attributes of
        every item in the keychain, envsec&apos;s or not.
      </li>
      <li>
        <Strong>Linux.</Strong> <Mono>secret-tool search</Mono> matches
        attributes exactly, which gets closer. But its output includes the
        secret values of the matches, and exact matching cannot express
        &quot;every key in contexts that start with <Mono>myapp</Mono>&quot;.
      </li>
      <li>
        <Strong>Windows.</Strong> <Mono>cmdkey /list</Mono> prints the stored
        targets, one block each. There is nothing in it to sort or filter by
        date.
      </li>
    </List>
    <P>
      You could store an expiry date in Secret Service attributes or in a
      Windows credential&apos;s comment field, but each OS would need its own
      scheme, and answering &quot;what expires this week&quot; would still mean
      reading every item. In envsec, each keychain operation is also a child
      process (on Windows, a PowerShell process that compiles a small C# class),
      so a listing built on the keychain gets slower with every secret you add.
    </P>
    <P>
      So the OS-specific interface in envsec has three methods, <Mono>set</Mono>
      , <Mono>get</Mono> and <Mono>remove</Mono>, all by exact name. How those
      map to each OS is in{" "}
      <Link className={LINK_CLASS} href="/blog/one-cli-three-keychains">
        One CLI, three keychains
      </Link>
      . Everything that needs listing, searching or sorting reads SQLite
      instead. <Mono>envsec list</Mono>, <Mono>search</Mono>, <Mono>audit</Mono>{" "}
      and shell completion never touch the keychain at all.
    </P>

    <H2>What goes in the database</H2>
    <P>
      The schema lives in <Mono>packages/core</Mono>, created on first open.
      Here it is reformatted for reading:
    </P>
    <CodeBlock code={SCHEMA} language="sql" />
    <List>
      <li>
        <Strong>
          <Mono>secrets</Mono>
        </Strong>{" "}
        has one row per context and key: timestamps and an optional expiry. The
        column is still called <Mono>env</Mono> because contexts were called
        environments in the first days of the project.
      </li>
      <li>
        <Strong>
          <Mono>commands</Mono>
        </Strong>{" "}
        holds saved command templates for <Mono>envsec cmd</Mono>, with{" "}
        <Mono>{"{key}"}</Mono> placeholders that are resolved when the command
        runs.
      </li>
      <li>
        <Strong>
          <Mono>env_exports</Mono>
        </Strong>{" "}
        records every file written by <Mono>envsec env-file</Mono>, so{" "}
        <Mono>envsec audit</Mono> can remind you that a plaintext copy exists,
        and drop the record once the file is gone.
      </li>
    </List>
    <P>
      Timestamps are UTC text in <Mono>YYYY-MM-DD HH:MM:SS</Mono> form, so
      &quot;expires before X&quot; is a plain string comparison. Every query
      uses <Mono>?</Mono> placeholders with bound parameters, and every row is
      decoded with an Effect <Mono>Schema</Mono> instead of being cast to a
      type:
    </P>
    <CodeBlock code={QUERIES} language="ts" />

    <H2>Where it lives, and who can read it</H2>
    <P>
      The default path is <Mono>~/.envsec/store.sqlite</Mono>. You can change it
      with <Mono>--db</Mono> or the <Mono>ENVSEC_DB</Mono> environment variable;
      when both are set, the flag wins. The flag is read straight from{" "}
      <Mono>argv</Mono> before the CLI parser runs, because the database layer
      has to exist before any command does.
    </P>
    <TerminalBlock code={DB_PATH} />
    <P>
      Every time the store opens, it sets the directory to <Mono>0700</Mono> and
      creates the file with <Mono>0600</Mono> before SQLite touches it:
    </P>
    <CodeBlock code={INIT_DB} language="ts" />
    <P>
      One consequence: the directory that holds the database is set to{" "}
      <Mono>0700</Mono> on every run, whatever it is. Point <Mono>--db</Mono> at
      a dedicated directory, not at a project root or a shared folder.
    </P>
    <P>
      Next to the database sits <Mono>completions.cache</Mono>, a JSON file with
      your context names, key names and saved command names, written with{" "}
      <Mono>0600</Mono>. It lets tab completion answer without opening SQLite.
    </P>

    <H2>What the metadata gives away</H2>
    <P>Values never go into SQLite. Everything else about your secrets does:</P>
    <List>
      <li>
        context and key names, such as <Mono>stripe.live-key</Mono>;
      </li>
      <li>
        when each secret was created and last updated, and when it expires;
      </li>
      <li>saved command templates;</li>
      <li>
        the paths of <Mono>.env</Mono> files you exported.
      </li>
    </List>
    <P>
      The database is not encrypted. File permissions keep other users out, but
      any process running as you can read it and learn which secrets you have,
      and for which services. I think that trade-off is acceptable because names
      are rarely the secret part: the same names already sit in your source code
      (<Mono>process.env.STRIPE_SECRET_KEY</Mono>), in <Mono>.env.example</Mono>{" "}
      files and in CI configuration. In exchange you get listing, search, expiry
      and completion without unlocking the keychain.
    </P>
    <P>
      Two things are worth doing anyway. Keep secrets out of saved command
      templates: a literal token typed into <Mono>envsec cmd</Mono> instead of a{" "}
      <Mono>{"{key}"}</Mono> placeholder ends up in SQLite as plaintext. And use
      full-disk encryption, which covers this file along with everything else in
      your home directory. The wider picture is in{" "}
      <Link className={LINK_CLASS} href="/blog/envsec-threat-model">
        What envsec does not protect you from
      </Link>
      .
    </P>

    <H2>From sql.js to node:sqlite</H2>
    <P>
      Until October 2026 the metadata store used <Mono>sql.js</Mono>, SQLite
      compiled to WebAssembly. sql.js keeps the database in memory, so envsec
      read the whole file at startup and, after every write, exported the whole
      database and wrote it back:
    </P>
    <CodeBlock code={SQLJS_PERSIST} language="ts" />
    <P>That design had three problems:</P>
    <List>
      <li>
        <Strong>Every write rewrote the file.</Strong> Changing one timestamp
        meant serialising and writing every page. Batches only reduced how often
        that happened.
      </li>
      <li>
        <Strong>No locking between processes.</Strong> Each envsec process
        worked on its own in-memory copy. If two processes overlapped, whichever
        wrote last replaced the file with its copy and dropped the other&apos;s
        changes.
      </li>
      <li>
        <Strong>Startup cost.</Strong> As I measured in{" "}
        <Link className={LINK_CLASS} href="/blog/effect-4-bun-performance">
          From 417 to 32 milliseconds
        </Link>
        , sql.js was a 23 MB package with a WASM module to instantiate on every
        start, and its WASM file could not be located at run time inside a
        compiled Bun binary.
      </li>
    </List>
    <P>
      The store now uses <Mono>DatabaseSync</Mono> from{" "}
      <ExternalLink href="https://nodejs.org/api/sqlite.html">
        node:sqlite
      </ExternalLink>
      , which works without a flag from Node 22.13 and is also available in Bun.
      Writes go to the file through SQLite itself, with its own journal and file
      locks. A second envsec process that finds the database locked waits up to
      5 seconds (<Mono>busy_timeout</Mono>) instead of failing. Batched commands
      (<Mono>move</Mono>, <Mono>copy</Mono>, <Mono>rename</Mono>,{" "}
      <Mono>delete --all</Mono> and <Mono>load --batch</Mono>) run inside{" "}
      <Mono>BEGIN IMMEDIATE</Mono> and <Mono>COMMIT</Mono>. On Node 22, loading
      the module prints an experimental warning; envsec filters out that one
      warning so it does not land on stderr on every run.
    </P>
    <P>
      I won&apos;t put a number on this change alone. In the performance post it
      shared a step with dropping <Mono>@effect/platform-node</Mono>, and the
      numbers there are for both changes together.
    </P>

    <H2>Two stores, no shared transaction</H2>
    <P>
      There is no transaction that covers a keychain write and a SQLite write.
      The keychains have no transactions to join, and I did not try to build
      two-phase commit on top of <Mono>security</Mono>, <Mono>secret-tool</Mono>{" "}
      and PowerShell. What envsec does instead is pick an order for each
      operation and compensate where it can.
    </P>
    <H3>Writes: value first, then metadata</H3>
    <P>
      <Mono>SecretStore.set</Mono> writes the keychain first. If the metadata
      write then fails, it puts the keychain back the way it was: the previous
      value for an update, or no item for a new secret.
    </P>
    <CodeBlock code={SET_FLOW} language="ts" />
    <P>
      The previous value matters. An earlier version always removed the keychain
      item when the metadata write failed, which for an update deleted the value
      you already had. The compensation is best effort: if it fails too, its
      error is ignored and you see the original metadata error.
    </P>
    <H3>Reads: metadata first</H3>
    <P>
      <Mono>SecretStore.get</Mono> checks for the metadata row before it touches
      the keychain. A secret with no row does not exist as far as envsec is
      concerned, even if the keychain item is there. A row with no item gets its
      own message, because that state has a clear fix:
    </P>
    <TerminalBlock code={ORPHAN_SESSION} />
    <P>
      That output is from my machine, with a throwaway context.{" "}
      <Mono>delete</Mono> works here because it ignores keychain errors on
      removal and then deletes the row. <Mono>envsec doctor</Mono> also counts
      rows whose keychain item cannot be read.
    </P>
    <H3>Batches commit what they did</H3>
    <P>
      Batched commands write metadata inside one SQLite transaction while the
      keychain work happens one secret at a time. If the batch fails halfway,
      envsec commits the transaction instead of rolling it back. That sounds
      backwards, but the keychain changes for the finished secrets have already
      happened, and rolling back the rows would hide them.
    </P>
    <H3>What is still not covered</H3>
    <DataTable columns={FAILURE_COLUMNS} rows={FAILURE_ROWS} />
    <P>
      The weak spot is the &quot;keychain item with no row&quot; case. It
      happens if envsec is killed between the two writes of an <Mono>add</Mono>,
      or if a keychain removal fails during <Mono>delete</Mono>. The value is
      still in your keychain, but <Mono>list</Mono> does not show it,{" "}
      <Mono>get</Mono> refuses it, and <Mono>doctor</Mono> does not look for it:
      its orphan check only goes from rows to items. Running the same{" "}
      <Mono>envsec add</Mono> again stores the value and recreates the row.
      There is no command that rebuilds the database from the keychain, and
      given how differently the three stores enumerate items, I don&apos;t plan
      to pretend there could be a reliable one.
    </P>
    <P>
      The same applies if you lose the database file: your values are still in
      the keychain, but envsec no longer knows their names. Back up{" "}
      <Mono>~/.envsec</Mono> along with the rest of your home directory.
    </P>

    <H2>In short</H2>
    <List>
      <li>
        The keychain is good at protecting one value by exact name. envsec asks
        it for nothing else.
      </li>
      <li>
        Names, timestamps, expiry, saved commands and <Mono>.env</Mono> export
        records live in SQLite at <Mono>~/.envsec/store.sqlite</Mono> (or{" "}
        <Mono>--db</Mono>, or <Mono>ENVSEC_DB</Mono>), with <Mono>0700</Mono>{" "}
        and <Mono>0600</Mono> permissions and bound parameters everywhere.
      </li>
      <li>
        That database reveals which secrets you have, not their values. It is
        not encrypted.
      </li>
      <li>
        <Mono>node:sqlite</Mono> replaced <Mono>sql.js</Mono>: real file writes,
        locking between processes, and no WASM to load.
      </li>
      <li>
        There is no transaction across both stores. Writes go value first and
        roll back on a metadata failure; a crash at the wrong moment can still
        leave a value in the keychain that envsec does not list.
      </li>
    </List>
  </PostLayout>
);

export default KeychainForValuesPost;
