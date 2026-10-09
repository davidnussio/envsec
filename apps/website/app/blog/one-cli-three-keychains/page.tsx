import Link from "next/link";

import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  DataTable,
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

const SLUG = "one-cli-three-keychains";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const KEYCHAIN_ACCESS = `export class KeychainAccess extends Context.Service<
  KeychainAccess,
  {
    readonly set: (
      service: string,
      account: string,
      password: string
    ) => Effect.Effect<void, KeychainError>;
    readonly get: (
      service: string,
      account: string
    ) => Effect.Effect<string, SecretNotFoundError | KeychainError>;
    readonly remove: (
      service: string,
      account: string
    ) => Effect.Effect<void, KeychainError>;
  }
>()("envsec/KeychainAccess") {}`;

const PLATFORM_LAYER = `export const PlatformKeychainAccessLive = (() => {
  switch (platform()) {
    case "darwin":
      return MacOsKeychainAccessLive;
    case "linux":
      return LinuxSecretServiceAccessLive;
    case "win32":
      return WindowsCredentialManagerAccessLive;
    default:
      return Layer.effect(
        KeychainAccess,
        Effect.fail(new UnsupportedPlatformError({ /* … */ }))
      );
  }
})();`;

const KEY_MAPPING = `const segmentPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u;

// "api.token" in context "myapp.dev"
const account = parts.at(-1); // "token"
const serviceParts = parts.slice(0, -1); // ["api"]
const service =
  serviceParts.length > 0
    ? \`envsec.\${env}.\${serviceParts.join(".")}\` // "envsec.myapp.dev.api"
    : \`envsec.\${env}\`;`;

const MAPPING_COLUMNS = [
  { label: "" },
  { label: "macOS" },
  { label: "Linux" },
  { label: "Windows" },
] as const;

const MAPPING_ROWS = [
  ["Tool", "security", "secret-tool", "powershell.exe + advapi32"],
  [
    "Item identity",
    "service + account",
    "attributes service, account",
    "target name",
  ],
  [
    "myapp.dev / api.token",
    "envsec.myapp.dev.api / token",
    "envsec.myapp.dev.api / token",
    "envsec:envsec.myapp.dev.api/token",
  ],
  ["Value handed over via", "argv (-w)", "stdin", "-Command script"],
  [
    "Not found means",
    "exit code 44",
    "empty stdout",
    "Win32 error 1168, exit 2",
  ],
] as const;

const MAC_SET = `run([
  "add-generic-password",
  "-U",
  "-s", service,
  "-a", account,
  "-w", password,
]);`;

const MAC_HEX = `$ security add-generic-password -U -s envsec.blogdemo.raw -a demo -w "café ⭐"
$ security find-generic-password -s envsec.blogdemo.raw -a demo -w
636166c3a920e2ad90`;

const MAC_B64 = `$ envsec -c blogdemo.dev add api.token -v "café ⭐ token"
✔ Secret "api.token" stored in context "blogdemo.dev"
$ security find-generic-password -s envsec.blogdemo.dev.api -a token -w
envsec:b64:Y2Fmw6kg4q2QIHRva2Vu`;

const LINUX_SET = `run(
  [
    "store",
    "--label",
    \`envsec:\${service}/\${account}\`,
    "service", service,
    "account", account,
  ],
  password // written to secret-tool's stdin
);`;

const LINUX_LOOKUP = `// A missing item gives empty output and no diagnostics (exit 0 or 1,
// depending on the libsecret version). Anything on stderr with a
// non-zero exit (locked keyring, D-Bus unavailable, …) is a real error
// and must not be reported as "not found".
if (result.exitCode !== 0 && result.stderr.trim() !== "") {
  return yield* new KeychainError({ command: "lookup", /* … */ });
}
if (result.stdout === "") {
  return yield* new SecretNotFoundError({ /* … */ });
}`;

const LINUX_CI = `eval "$(dbus-launch --sh-syntax)"
echo "DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS" >> "$GITHUB_ENV"
echo "test" | gnome-keyring-daemon --unlock --components=secrets`;

const WINDOWS_READ = `public static string Read(string target) {
  IntPtr ptr;
  if (!CredRead(target, 1, 0, out ptr)) {
    var err = Marshal.GetLastWin32Error();
    if (err == 1168) return null; // ERROR_NOT_FOUND
    throw new System.ComponentModel.Win32Exception(err);
  }
  var c = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
  var pw = Marshal.PtrToStringUni(c.CredentialBlob, c.CredentialBlobSize / 2);
  CredFree(ptr);
  return pw;
}`;

const WINDOWS_ESCAPE = `const escapePS = (s: string): string =>
  s.replaceAll("\\0", "").replaceAll("'", "''");

// …later, in the generated script:
\`$ok = [CredWriter]::Write('\${target}', '\${user}', '\${password}')\``;

const BASE64 = `const B64_PREFIX = "envsec:b64:";

const encodeValue = (value: string): string =>
  \`\${B64_PREFIX}\${Buffer.from(value, "utf-8").toString("base64")}\`;

const decodeValue = (raw: string): string => {
  if (raw.startsWith(B64_PREFIX)) {
    return Buffer.from(raw.slice(B64_PREFIX.length), "base64").toString(
      "utf-8"
    );
  }
  // Legacy: return plaintext values as-is for backward compatibility
  return raw;
};`;

const DOCTOR_COLUMNS = [
  { label: "" },
  { label: "Credential store" },
  { label: "Keychain read/write" },
] as const;

const DOCTOR_ROWS = [
  [
    "macOS",
    "security list-keychains exits 0",
    "adds, reads back and deletes envsec.doctor.test / probe",
  ],
  [
    "Linux",
    "secret-tool --version can be started",
    "only checks that secret-tool can be started",
  ],
  ["Windows", "PowerShell finds cmdkey", "skipped"],
] as const;

const OneCliThreeKeychainsPost = () => (
  <PostLayout
    lead={
      <p>
        Every desktop OS ships a credential store, and every one of them speaks
        a different language. macOS has a command-line tool. Linux has a D-Bus
        API with a small CLI on top. Windows has a Win32 API and a CLI that can
        write passwords but not read them back. A tool that promises to keep
        secrets &quot;in the OS keychain&quot; is three adapters behind one
        interface.
      </p>
    }
    slug={SLUG}
  >
    <P>
      This post walks through those three adapters in envsec: how a key maps to
      an item on each OS, which commands run, how values get there without being
      mangled, and how three different sets of failure modes collapse into two
      error types. The code excerpts are from <Mono>packages/core/src</Mono>,
      trimmed.
    </P>

    <H2>The contract: three operations</H2>
    <P>
      The whole OS-specific surface is an Effect service with three methods.
      Values go in and out as strings; the two error types are the only things a
      caller has to handle.
    </P>
    <CodeBlock code={KEYCHAIN_ACCESS} language="ts" />
    <P>
      There is no <Mono>list</Mono> and no <Mono>search</Mono>. Exact lookup by
      name is the one thing all three stores do well and in the same way, so
      that is all the interface asks for. Listing, expiry and search live in a
      SQLite database instead; I explain that split in{" "}
      <Link
        className={LINK_CLASS}
        href="/blog/keychain-for-values-sqlite-for-metadata"
      >
        Why secret values live in the keychain and metadata in SQLite
      </Link>
      .
    </P>
    <P>The implementation is picked once, when the module loads:</P>
    <CodeBlock code={PLATFORM_LAYER} language="ts" />
    <P>
      On top of it sits <Mono>SecretStore</Mono>, which combines the keychain
      with the metadata store. The CLI, the TUI and the SDK all go through{" "}
      <Mono>SecretStore</Mono>, so none of them knows which OS it runs on.
    </P>

    <H2>From a key to a keychain item</H2>
    <P>
      An envsec secret is addressed by a context (<Mono>myapp.dev</Mono>) and a
      dotted key (<Mono>api.token</Mono>). Every store wants a pair of names, so
      the last key segment becomes the account and everything else becomes the
      service, prefixed with <Mono>envsec.</Mono>:
    </P>
    <CodeBlock code={KEY_MAPPING} language="ts" />
    <P>
      Each key segment must match that pattern, and context names are limited to
      letters, digits, dots, hyphens and underscores. That validation is the
      first line of defence for the Windows adapter below: no name that reaches
      a PowerShell script can contain a quote.
    </P>
    <DataTable
      caption="How one secret is addressed on each OS."
      columns={MAPPING_COLUMNS}
      rows={MAPPING_ROWS}
    />
    <P>
      The mapping has a sharp edge I should be upfront about. Both contexts and
      keys can contain dots, so context <Mono>myapp</Mono> with key{" "}
      <Mono>dev.api.token</Mono> and context <Mono>myapp.dev</Mono> with key{" "}
      <Mono>api.token</Mono> land on the same item. It takes an unusual naming
      scheme to hit this, and up to 1.1.2 the second write silently replaced the
      first. Since 1.1.3 envsec looks for such an alias in the metadata before
      writing and refuses the second key with an error, and deleting one of two
      secrets that already collide keeps the shared item. The naming itself is
      unchanged, so existing secrets keep working.
    </P>

    <H2>macOS: the security CLI</H2>
    <P>
      macOS ships <Mono>/usr/bin/security</Mono>, which covers what envsec needs
      with three subcommands: <Mono>add-generic-password</Mono>,{" "}
      <Mono>find-generic-password</Mono> and{" "}
      <Mono>delete-generic-password</Mono>, each with <Mono>-s</Mono> for the
      service and <Mono>-a</Mono> for the account. <Mono>-U</Mono> updates an
      existing item instead of failing, and <Mono>-w</Mono> passes the password
      on write and prints only the password on read.
    </P>
    <CodeBlock code={MAC_SET} language="ts" />
    <P>
      Every adapter starts its helper with <Mono>execFile</Mono>, never through
      a shell, so arguments are never re-parsed. The adapter passes the
      AbortSignal from <Mono>Effect.callback</Mono> to <Mono>execFile</Mono>: if
      you press Ctrl-C, the <Mono>security</Mono> process is killed instead of
      left behind. Debug logs record the subcommand and the exit code, never the
      arguments.
    </P>
    <P>
      There is a cost to <Mono>-w</Mono>: the value is on the command line of
      the <Mono>security</Mono> process for as long as it runs, so it shows up
      in a process listing during that time. It is base64, not plaintext, but
      base64 is an encoding, not protection. I cover what that means in{" "}
      <Link className={LINK_CLASS} href="/blog/envsec-threat-model">
        What envsec does not protect you from
      </Link>
      .
    </P>
    <P>
      Errors on macOS are unambiguous. A missing item makes{" "}
      <Mono>security</Mono> exit with code 44, which the adapter turns into{" "}
      <Mono>SecretNotFoundError</Mono>. Any other non-zero exit becomes a{" "}
      <Mono>KeychainError</Mono> carrying stderr.
    </P>

    <H2>Linux: secret-tool and the Secret Service</H2>
    <P>
      On Linux, envsec talks to the freedesktop.org{" "}
      <ExternalLink href="https://specifications.freedesktop.org/secret-service-spec/latest/">
        Secret Service API
      </ExternalLink>{" "}
      through <Mono>secret-tool</Mono> from libsecret (the{" "}
      <Mono>libsecret-tools</Mono> package on Debian and Ubuntu). Items are
      identified by attributes rather than fixed fields, and envsec uses two:{" "}
      <Mono>service</Mono> and <Mono>account</Mono>. The label is what you see
      in a keyring GUI.
    </P>
    <CodeBlock code={LINUX_SET} language="ts" />
    <P>
      Of the three adapters this is the only one where the value never appears
      on a command line: <Mono>secret-tool store</Mono> reads the password from
      stdin. Reading uses <Mono>secret-tool lookup service … account …</Mono>{" "}
      and removing uses <Mono>secret-tool clear</Mono> with the same attributes.
    </P>
    <H3>The &quot;not found&quot; trap</H3>
    <P>
      <Mono>secret-tool lookup</Mono> does not have a dedicated exit code for a
      missing item. It prints nothing, and exits 0 or 1 depending on the
      libsecret version. Until October 2026 the adapter treated any failure as
      &quot;not found&quot;, which meant a locked keyring or a missing D-Bus
      session looked exactly like a secret that did not exist, and the SDK
      quietly returned <Mono>null</Mono>. The current rule:
    </P>
    <CodeBlock code={LINUX_LOOKUP} language="ts" />
    <H3>Headless machines</H3>
    <P>
      <Mono>secret-tool</Mono> is a client. It needs a D-Bus session bus and a
      running Secret Service provider (GNOME Keyring, KWallet or another
      implementation) with an unlocked collection. A typical GNOME or KDE
      desktop session gives you all of that. An SSH session into a server or a
      CI runner usually gives you none of it, and envsec then fails with a{" "}
      <Mono>KeychainError</Mono> that carries <Mono>secret-tool</Mono>&apos;s
      stderr. On the Ubuntu CI runners, the end-to-end job starts a bus and an
      unlocked keyring before the tests:
    </P>
    <CodeBlock code={LINUX_CI} language="bash" />
    <P>
      The password piped into <Mono>gnome-keyring-daemon</Mono> is a throwaway
      for that runner. The details of that setup are in{" "}
      <Link className={LINK_CLASS} href="/blog/testing-keychains-in-ci">
        Testing a keychain CLI on three OSes in CI
      </Link>
      .
    </P>

    <H2>Windows: from cmdkey to CredWrite</H2>
    <P>
      Windows Credential Manager is where the adapter changed most. If you have
      read &quot;cmdkey + PowerShell&quot; in envsec&apos;s docs, that describes
      an older version: the current adapter does not run <Mono>cmdkey</Mono> at
      all. It got there in three steps:
    </P>
    <OrderedList>
      <li>
        <Strong>March 2026:</Strong> writes and deletes went through{" "}
        <Mono>cmdkey /generic:… /user:… /pass:…</Mono> inside PowerShell.{" "}
        <Mono>cmdkey</Mono> cannot print a stored password, so reads already
        used a P/Invoke call to <Mono>CredRead</Mono>.
      </li>
      <li>
        <Strong>Five days later:</Strong> to handle spaces and special
        characters, the call was wrapped in <Mono>cmd /c</Mono> with double
        quotes and <Mono>^</Mono>-escaping for <Mono>cmd.exe</Mono>{" "}
        metacharacters. That is three layers of quoting (JavaScript, PowerShell,{" "}
        <Mono>cmd.exe</Mono>). One of the escaping rules, doubling{" "}
        <Mono>%</Mono>, was removed again 35 minutes later.
      </li>
      <li>
        <Strong>April 2026:</Strong> all three operations moved to P/Invoke
        calls into <Mono>advapi32.dll</Mono> (<Mono>CredWriteW</Mono>,{" "}
        <Mono>CredReadW</Mono>, <Mono>CredDeleteW</Mono>), compiled with{" "}
        <Mono>Add-Type</Mono> in a PowerShell script. One quoting layer is left.
      </li>
    </OrderedList>
    <P>
      The read side looks like this. Credentials are generic (type 1), the
      target name is <Mono>envsec:&lt;service&gt;/&lt;account&gt;</Mono>, and
      the blob is UTF-16, hence the division by two:
    </P>
    <CodeBlock code={WINDOWS_READ} language="csharp" />
    <P>
      The PowerShell wrapper exits with code 2 when <Mono>Read</Mono> returns
      null, and the adapter maps exit 2 to <Mono>SecretNotFoundError</Mono>.
      Until October, any <Mono>CredRead</Mono> failure exited 1 and counted as
      &quot;not found&quot;, the same trap as on Linux. Now only{" "}
      <Mono>ERROR_NOT_FOUND</Mono> (1168) does; every other Win32 error throws
      and becomes a <Mono>KeychainError</Mono>.
    </P>
    <H3>The one quoting layer left</H3>
    <P>
      Dynamic values are spliced into the script as PowerShell single-quoted
      strings. Inside those, ASCII <Mono>&apos;</Mono> is doubled and NUL bytes
      are stripped:
    </P>
    <CodeBlock code={WINDOWS_ESCAPE} language="ts" />
    <P>
      I do not rely on that function alone. The target and user name come from
      validated keys and contexts, and the password is base64 (next section), so
      every string that reaches the script is plain ASCII with no quote
      characters in it. The escaping is a second layer, not the only one.
    </P>
    <H3>Two limits worth knowing</H3>
    <List>
      <li>
        <Strong>Output buffer.</Strong> One commit (<Mono>2cd38e9b3</Mono>) set{" "}
        <Mono>maxBuffer</Mono> to 1 MB on the <Mono>execFile</Mono> call. That
        option caps how much stdout and stderr the child may produce, not the
        size of the script, and 1 MB is also Node&apos;s documented default, so
        on Node it makes the limit explicit rather than raising it.
      </li>
      <li>
        <Strong>Value size.</Strong> The{" "}
        <ExternalLink href="https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw">
          CREDENTIAL structure
        </ExternalLink>{" "}
        caps the blob at <Mono>CRED_MAX_CREDENTIAL_BLOB_SIZE</Mono> (5 × 512
        bytes). envsec stores the base64 string as UTF-16, so by my arithmetic
        the largest value it can store on Windows is about 950 bytes of UTF-8. I
        have not tested that boundary on a real machine.
      </li>
    </List>
    <P>
      Every operation also starts a PowerShell process and compiles a small C#
      class. I have not measured it, but it is the heaviest of the three paths.
    </P>

    <H2>Why every value is base64</H2>
    <P>
      Until late March 2026, envsec stored values as given. That breaks on macOS
      as soon as a value contains non-ASCII characters:{" "}
      <Mono>security find-generic-password -w</Mono> prints it as hex. Here it
      is on my machine, with a throwaway item:
    </P>
    <TerminalBlock code={MAC_HEX} />
    <P>
      Rather than detect and decode hex on one OS and fight quoting on another,{" "}
      <Mono>SecretStore</Mono> now encodes every value before it reaches any
      adapter:
    </P>
    <CodeBlock code={BASE64} language="ts" />
    <P>The same secret written through envsec:</P>
    <TerminalBlock code={MAC_B64} />
    <P>That one change does several jobs:</P>
    <List>
      <li>
        Every adapter only ever sees ASCII, so Unicode values and emoji survive
        the round trip on all three OSes. The end-to-end suite stores and reads
        back <Mono>café résumé naïve</Mono> and an emoji string on each of them.
      </li>
      <li>
        The adapters strip whitespace from the output they read back. With
        base64 that is harmless; with raw values it would eat spaces at the ends
        of a value.
      </li>
      <li>
        On Windows, it is the reason the password can never contain a quote
        character.
      </li>
    </List>
    <P>
      The prefix makes it backward compatible: an item written before the change
      has no <Mono>envsec:b64:</Mono> prefix and is returned unchanged.
    </P>

    <H2>Normalising errors</H2>
    <P>Each adapter reduces its OS to the same three outcomes:</P>
    <List>
      <li>
        <Strong>Success</Strong>, with the stored string.
      </li>
      <li>
        <Strong>
          <Mono>SecretNotFoundError</Mono>
        </Strong>{" "}
        only for an unambiguous &quot;no such item&quot;: exit 44 on macOS,
        empty output on Linux, Win32 error 1168 on Windows.
      </li>
      <li>
        <Strong>
          <Mono>KeychainError</Mono>
        </Strong>{" "}
        for everything else, with the subcommand (or Win32 function) and stderr
        attached. If the helper itself is missing, the message says what to
        install: <Mono>libsecret-tools</Mono> on Linux, PowerShell on Windows.
      </li>
    </List>
    <P>
      The distinction matters more than it looks. &quot;Not found&quot; is
      something callers act on: <Mono>SecretStore.get</Mono> turns it into a
      message telling you to clean up stale metadata, and the SDK returns{" "}
      <Mono>null</Mono>. A locked keyring must never take that path. Both bugs I
      described above, on Linux and on Windows, were the same bug: a real
      failure reported as a missing secret.
    </P>

    <H2>What envsec doctor checks on each OS</H2>
    <P>
      <Mono>envsec doctor</Mono> runs the same database checks everywhere
      (directory, permissions, schema, expired secrets, and metadata rows whose
      keychain item can no longer be read). The credential store checks differ:
    </P>
    <DataTable columns={DOCTOR_COLUMNS} rows={DOCTOR_ROWS} />
    <P>
      Only macOS gets a real round trip. On Linux, doctor confirms that{" "}
      <Mono>secret-tool</Mono> is installed, not that a keyring daemon is
      running and unlocked, which is the failure you are most likely to hit. On
      Windows it still looks for <Mono>cmdkey</Mono>, a leftover from the old
      adapter. The end-to-end suite also skips doctor on Linux CI, with a note
      that it hangs there.
    </P>

    <H2>In short</H2>
    <List>
      <li>
        One Effect service with <Mono>set</Mono>, <Mono>get</Mono> and{" "}
        <Mono>remove</Mono>; one implementation per OS, picked at load time.
      </li>
      <li>
        A key maps to <Mono>envsec.&lt;context&gt;.&lt;prefix&gt;</Mono> plus
        the last segment as account. Validation keeps quotes and shell
        metacharacters out of every name.
      </li>
      <li>
        macOS uses <Mono>security</Mono>, Linux uses <Mono>secret-tool</Mono>{" "}
        over D-Bus, Windows uses P/Invoke into <Mono>advapi32</Mono> from
        PowerShell. Only Linux keeps the value off the command line.
      </li>
      <li>
        Values are base64 with an <Mono>envsec:b64:</Mono> prefix, which fixed
        Unicode on macOS and removed a whole class of quoting problems on
        Windows.
      </li>
      <li>
        &quot;Not found&quot; is reported only when the OS says so
        unambiguously; everything else is a <Mono>KeychainError</Mono>.
      </li>
    </List>
  </PostLayout>
);

export default OneCliThreeKeychainsPost;
