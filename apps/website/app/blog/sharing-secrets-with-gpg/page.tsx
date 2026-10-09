import Link from "next/link";

import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  ExternalLink,
  H2,
  H3,
  List,
  Mono,
  OrderedList,
  P,
  Strong,
} from "@/components/blog/prose";
import { CodeBlock } from "@/components/code-block";
import { TerminalBlock } from "@/components/terminal-block";

const SLUG = "sharing-secrets-with-gpg";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const GPG_CALL = `execFileSync("gpg", [
  "--batch", "--yes",
  "--trust-model", "always",
  "--encrypt", "--armor",
  "--recipient", recipient,
], { encoding: "utf-8", input: plaintext });`;

const PAYLOAD = `DB_PASSWORD="p@ss\\"w0rd"
STRIPE_SECRET_KEY="sk_test_123"
TLS_CERT="-----BEGIN CERTIFICATE-----\\nMIIB...\\n-----END CERTIFICATE-----"`;

const BOB_KEY = `# Bob: create a key pair (skip this if you already have one)
gpg --quick-gen-key "Bob Example <bob@example.com>" default default 1y
# Export the public key and send it to Alice; any channel is fine
gpg --armor --export bob@example.com > bob.pub.asc
# Show the fingerprint, to read out to Alice on a call
gpg --fingerprint bob@example.com`;

const ALICE_SHARE = `# Alice: import Bob's key and compare the fingerprint with what he read out
gpg --import bob.pub.asc
gpg --fingerprint bob@example.com
# Encrypt the whole context to that exact key
envsec -c myapp.dev share --encrypt-to 1DB04155CDCADCE4B08ED3035648FD56E16C4BB8 -o myapp-dev.asc`;

const ALICE_OUTPUT = `◈ Encrypted 3 secrets from "myapp.dev" for 1DB04155CDCADCE4B08ED3035648FD56E16C4BB8 → myapp-dev.asc`;

const BOB_IMPORT = `# Bob: decrypt straight into envsec, no plaintext file
gpg --quiet --decrypt myapp-dev.asc | envsec -c myapp.dev load -i /dev/stdin
# Done with the file
rm myapp-dev.asc`;

const BOB_OUTPUT = `✔ Done: 3 added, 0 overwritten, 0 skipped`;

const SIGN = `# Alice: sign the encrypted file with her own key
gpg --armor --detach-sign myapp-dev.asc
# Bob: check the signature before importing (needs Alice's public key)
gpg --verify myapp-dev.asc.asc myapp-dev.asc`;

const SharingSecretsWithGpgPost = () => (
  <PostLayout
    lead={
      <p>
        A new teammate needs the staging database password and a Stripe test
        key. The fastest way to hand them over is to paste them into a chat
        message. That message is then stored, synced to every device both of you
        are signed in on, searchable, and kept for as long as your workspace
        keeps history, which is usually much longer than the onboarding.
      </p>
    }
    slug={SLUG}
  >
    <P>
      The alternative people reach for next is a password manager with shared
      vaults, and for a team that shares secrets every week it&apos;s the right
      answer. But sometimes it&apos;s just two people, once, with no shared
      account. For that case envsec has <Mono>envsec share</Mono>, which
      encrypts a context with GPG for one recipient. This post explains exactly
      what it does, how the receiver imports the result, and where GPG falls
      short.
    </P>

    <H2>What envsec share does</H2>
    <P>
      <Mono>envsec share</Mono> takes one context and one recipient. It reads
      every secret of the context from the OS credential store, builds a
      plaintext payload in memory, and pipes it into <Mono>gpg</Mono> on
      standard input. This is the call, from{" "}
      <Mono>packages/cli/src/cli/share.ts</Mono>:
    </P>
    <CodeBlock code={GPG_CALL} language="ts" />
    <P>A few details follow from that call:</P>
    <List>
      <li>
        <Strong>
          No plaintext on the sender&apos;s disk, nothing in argv.
        </Strong>{" "}
        Values travel through a pipe to <Mono>gpg</Mono>, so they never appear
        in a temporary file or in the process list.
      </li>
      <li>
        <Strong>The output is ASCII-armored</Strong> (<Mono>--armor</Mono>): a{" "}
        <Mono>-----BEGIN PGP MESSAGE-----</Mono> block you can attach to an
        email or drop into a file. Without <Mono>-o</Mono> it goes to stdout;
        with <Mono>-o file</Mono> envsec writes the file and prints a summary on
        stderr.
      </li>
      <li>
        <Strong>One recipient per run.</Strong> <Mono>--encrypt-to</Mono> is
        required and accepts an email, a key ID or a fingerprint, which gpg
        resolves against your keyring.
      </li>
      <li>
        <Strong>Missing values are skipped, with a warning.</Strong> If the
        metadata lists a key whose keychain entry is gone, envsec prints{" "}
        <Mono>▲ Skipped 1 secret no longer in keychain</Mono> followed by the
        key names, and shares the rest.
      </li>
    </List>
    <P>
      The payload inside is the same format <Mono>envsec env-file</Mono> writes:
      one <Mono>KEY=&quot;value&quot;</Mono> line per secret, the key
      upper-cased with dots turned into underscores, and backslashes, double
      quotes and newlines escaped:
    </P>
    <CodeBlock code={PAYLOAD} language="bash" />
    <P>
      With the global <Mono>--json</Mono> flag the payload is a JSON object
      instead, <Mono>{"{ context, secrets: [{ key, value }] }"}</Mono>, with the
      original key names.
    </P>

    <H2>Why GPG</H2>
    <P>
      I didn&apos;t want envsec to implement any cryptography of its own, and I
      wanted the receiver to be able to decrypt the file without envsec
      installed. GPG fits both:
    </P>
    <List>
      <li>
        <Strong>It&apos;s everywhere.</Strong> Linux distributions package it,
        Homebrew has it, and{" "}
        <ExternalLink href="https://gpg4win.org/">Gpg4win</ExternalLink> covers
        Windows. envsec only needs a <Mono>gpg</Mono> binary on the{" "}
        <Mono>PATH</Mono>.
      </li>
      <li>
        <Strong>People already have keys.</Strong> Some of your teammates may
        already use one, for example to sign git commits. If they do, there is
        no setup at all.
      </li>
      <li>
        <Strong>The output is a standard format.</Strong> Anyone with the
        private key can open it with <Mono>gpg --decrypt</Mono>, years from now,
        with or without envsec.
      </li>
    </List>

    <H2>A complete example</H2>
    <P>
      Alice has the <Mono>myapp.dev</Mono> secrets; Bob needs them. Both have{" "}
      <Mono>gpg</Mono> and envsec installed. Bob starts, because Alice needs his
      public key:
    </P>
    <TerminalBlock code={BOB_KEY} />
    <P>
      <Mono>--quick-gen-key</Mono> asks for a passphrase to protect the private
      key. The fingerprint check is the step people skip, and it is the one that
      matters: it&apos;s how Alice knows the key she received is Bob&apos;s and
      not someone else&apos;s. Alice imports the key, compares fingerprints, and
      encrypts:
    </P>
    <TerminalBlock code={ALICE_SHARE} />
    <CodeBlock code={ALICE_OUTPUT} language="text" />
    <P>
      She sends <Mono>myapp-dev.asc</Mono> however she likes; it&apos;s
      encrypted. Bob imports it with <Mono>envsec load</Mono>. There is no
      dedicated import command: <Mono>load</Mono> reads the <Mono>.env</Mono>{" "}
      format that <Mono>share</Mono> produces. It takes a file path (
      <Mono>-i</Mono>, default <Mono>.env</Mono>) rather than standard input, so
      on macOS and Linux the pipe goes through <Mono>/dev/stdin</Mono> and the
      decrypted text never lands on disk:
    </P>
    <TerminalBlock code={BOB_IMPORT} />
    <CodeBlock code={BOB_OUTPUT} language="text" />
    <P>
      Process substitution works as well: <Mono>-i &lt;(gpg -q -d …)</Mono> in
      bash and zsh, <Mono>-i (gpg -q -d … | psub --fifo)</Mono> in fish. Note
      the <Mono>--fifo</Mono>: plain <Mono>psub</Mono> writes the output to a
      temporary file. On Windows there is no <Mono>/dev/stdin</Mono>, so you
      would decrypt to a file and delete it after the import. If{" "}
      <Mono>myapp.dev</Mono> already has one of the keys, <Mono>load</Mono>{" "}
      skips it and tells you; add <Mono>--force</Mono> to overwrite.
    </P>

    <H2>What doesn&apos;t survive the trip</H2>
    <P>
      <Mono>share</Mono> and <Mono>load</Mono> are two separate commands joined
      by the <Mono>.env</Mono> format, and that format is lossy for envsec keys:
    </P>
    <List>
      <li>
        <Strong>Underscores and case.</Strong> <Mono>load</Mono> maps{" "}
        <Mono>STRIPE_SECRET_KEY</Mono> back by lower-casing it and turning every
        underscore into a dot. A key named <Mono>stripe.secret_key</Mono> on
        Alice&apos;s side arrives as <Mono>stripe.secret.key</Mono> on
        Bob&apos;s. Keys made only of lower-case segments without underscores,
        like <Mono>db.password</Mono>, round-trip unchanged.
      </li>
      <li>
        <Strong>Metadata.</Strong> Expiry dates set with{" "}
        <Mono>add --expires</Mono> aren&apos;t in the payload, so{" "}
        <Mono>envsec audit</Mono> on Bob&apos;s machine won&apos;t know about
        them.
      </li>
      <li>
        <Strong>Selection.</Strong> <Mono>share</Mono> always sends the whole
        context. To send a subset, copy it into a temporary context first (
        <Mono>envsec -c myapp.dev copy &quot;stripe.*&quot; --to tmp.bob</Mono>
        ), share that, then delete it.
      </li>
    </List>
    <P>
      The <Mono>--json</Mono> payload keeps the exact key names, but there is no
      command that imports it today.
    </P>

    <H2>The downsides of GPG</H2>
    <H3>The user experience</H3>
    <P>
      Keyrings, trust models, subkeys, the agent, pinentry, expiry dates: GPG
      asks a lot of people who only want to send a password. The example above
      is the short path, and it still takes six commands across two people
      before anything is encrypted.
    </P>
    <H3>Key management</H3>
    <P>
      If Bob loses his private key or forgets the passphrase, the file is
      unreadable and Alice has to share again. If his key expires or is revoked,
      Alice needs the updated key before the next share. None of this is hard,
      but all of it is manual.
    </P>
    <H3>No forward secrecy</H3>
    <P>
      The file is encrypted to Bob&apos;s long-term key. Anyone who keeps a copy
      of it, in a mailbox, a chat upload or a backup, and later gets Bob&apos;s
      private key and passphrase can decrypt it. That&apos;s why the example
      ends with <Mono>rm</Mono>, and why the file should travel through
      something you can delete it from.
    </P>
    <H3>Metadata</H3>
    <P>
      The content is encrypted; the envelope is not. The message carries the ID
      of the key it was encrypted to (<Mono>gpg --list-packets</Mono> shows it),
      its size hints at how much is inside, and the channel you send it through
      records who sent what to whom, and when.
    </P>
    <H3>No proof of who sent it</H3>
    <P>
      envsec encrypts but doesn&apos;t sign. Anyone with Bob&apos;s public key
      can produce a file that looks the same, and Bob can&apos;t tell from the
      file alone that Alice made it. If that matters, Alice can sign the
      encrypted file separately:
    </P>
    <TerminalBlock code={SIGN} />
    <H3>Trusting the wrong key</H3>
    <P>
      envsec passes <Mono>--trust-model always</Mono>, so gpg encrypts to
      whatever key matches the recipient without checking whether anyone
      certified it. Without that flag, gpg in batch mode refuses a freshly
      imported key that nobody you trust has certified, with &quot;There is no
      assurance this key belongs to the named user&quot;. That would stop most
      first-time users. The cost is that the fingerprint check is entirely up to
      you. Pass the full fingerprint, not an email: when I tried an email that
      wasn&apos;t in my keyring, gpg went looking for a key over the network.
    </P>

    <H2>The alternatives</H2>
    <List>
      <li>
        <Strong>
          <ExternalLink href="https://github.com/FiloSottile/age">
            age
          </ExternalLink>
          .
        </Strong>{" "}
        A small, modern file encryption tool with short <Mono>age1…</Mono>{" "}
        public keys, multiple recipients with repeated <Mono>-r</Mono>, and the
        option to encrypt to someone&apos;s SSH public key. It is much easier to
        get right than GPG. It doesn&apos;t sign either, and{" "}
        <Mono>envsec share</Mono> doesn&apos;t support it today.
      </li>
      <li>
        <Strong>
          <ExternalLink href="https://github.com/getsops/sops">
            sops
          </ExternalLink>
          .
        </Strong>{" "}
        Encrypts the values inside YAML, JSON, ENV and INI files while the keys
        stay readable, with age, PGP or cloud KMS keys. That makes it a good fit
        for secrets that live in a repository and are decrypted by several
        people and by CI. It&apos;s more setup than a one-off handover needs.
      </li>
      <li>
        <Strong>1Password shared vaults.</Strong> For ongoing sharing this is
        better than any file: access is revoked centrally, and a changed value
        reaches everyone. It needs a paid account for everyone involved.{" "}
        <Link
          className={LINK_CLASS}
          href="/blog/envsec-vs-dotenv-1password-direnv"
        >
          envsec vs dotenv vs 1Password CLI vs direnv
        </Link>{" "}
        covers when that trade is worth it.
      </li>
      <li>
        <Strong>Slack, Teams, email.</Strong> Don&apos;t. And if a secret has
        already been pasted into one, rotate it.
      </li>
    </List>

    <H2>In short</H2>
    <OrderedList>
      <li>
        The receiver sends a public key and reads out its fingerprint on a
        separate channel.
      </li>
      <li>
        The sender runs{" "}
        <Mono>envsec -c ctx share --encrypt-to FINGERPRINT -o file.asc</Mono>.
      </li>
      <li>
        The receiver runs{" "}
        <Mono>gpg -q -d file.asc | envsec -c ctx load -i /dev/stdin</Mono> and
        deletes the file.
      </li>
    </OrderedList>
    <P>
      It&apos;s a handover, not a sync: nothing updates when the value changes,
      and nothing tells you who still has a copy. For two people and one
      context, that&apos;s often all you need. For anything recurring, use a
      shared vault. The{" "}
      <Link className={LINK_CLASS} href="/docs">
        docs
      </Link>{" "}
      list every <Mono>share</Mono> and <Mono>load</Mono> flag, and{" "}
      <Link className={LINK_CLASS} href="/blog/envsec-threat-model">
        What envsec does not protect you from
      </Link>{" "}
      covers the rest of the threat model.
    </P>
  </PostLayout>
);

export default SharingSecretsWithGpgPost;
