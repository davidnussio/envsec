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

const SLUG = "testing-keychains-in-ci";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const MODE_SWITCH = `if [[ -n "\${ENVSEC_E2E_CLI:-}" ]]; then
  CLI="$ENVSEC_E2E_CLI"
  export ENVSEC_E2E_ISOLATED="\${ENVSEC_E2E_ISOLATED:-0}"
else
  CLI="$SCRIPT_DIR/e2e-main.mjs"
  export ENVSEC_E2E_ISOLATED=1
fi

TMPDIR_TEST=$(mktemp -d)
export ENVSEC_DB="$TMPDIR_TEST/store.sqlite"
export ENVSEC_E2E_KEYCHAIN="$TMPDIR_TEST/keychain.json"
trap 'cleanup_secrets; rm -rf "$TMPDIR_TEST"' EXIT

cleanup_secrets`;

const FILE_KEYCHAIN = `// packages/cli/test/e2e-main.mjs (trimmed)
const fileKeychainLayer = Layer.succeed(
  KeychainAccess,
  KeychainAccess.of({ get, remove, set }) // backed by a JSON file
);

const metadataLayer = SqliteMetadataStoreLive.pipe(
  Layer.provide(DatabaseConfigFrom(databasePath))
);
const secretStoreLayer = SecretStore.layerNoDeps.pipe(
  Layer.provide(Layer.merge(fileKeychainLayer, metadataLayer))
);

runCliWithLayer(cachePath, secretStoreLayer);`;

const RUN_LOCALLY = `# Isolated: JSON-file keychain, temporary database
pnpm --filter envsec test

# Native: the real credential store of this machine
ENVSEC_E2E_CLI="$PWD/packages/cli/dist/main.js" \\
  ENVSEC_E2E_ISOLATED=0 \\
  pnpm --filter envsec test`;

const LINUX_KEYRING = `- name: Install gnome-keyring (Linux)
  if: runner.os == 'Linux'
  run: |
    sudo apt-get update
    sudo apt-get install -y gnome-keyring dbus-x11 \\
      libsecret-1-0 libsecret-tools

- name: Start D-Bus & unlock keyring (Linux)
  if: runner.os == 'Linux'
  run: |
    eval "$(dbus-launch --sh-syntax)"
    echo "DBUS_SESSION_BUS_ADDRESS=$DBUS_SESSION_BUS_ADDRESS" >> "$GITHUB_ENV"
    echo "test" | gnome-keyring-daemon --unlock --components=secrets

- name: Run E2E tests
  run: bash packages/cli/test/e2e-test.sh
  env:
    ENVSEC_E2E_CLI: \${{ github.workspace }}/packages/cli/dist/main.js
    ENVSEC_E2E_ISOLATED: "0"`;

const STALE_DELETE = `# Delete directly from the credential store (bypass envsec),
# leaving metadata orphaned.
if [[ "$ENVSEC_E2E_ISOLATED" == "1" ]]; then
  node "$CLI" __e2e_delete_keychain "envsec.\${CTX_STALE}.stale" "secret"
elif [[ "$(uname)" == "Darwin" ]]; then
  security delete-generic-password \\
    -s "envsec.\${CTX_STALE}.stale" -a "secret"
else
  secret-tool clear \\
    service "envsec.\${CTX_STALE}.stale" account "secret"
fi`;

const STALE_DELETE_PS = `& cmd /c "cmdkey /delete:\`"envsec:envsec.\${CTX_STALE}.stale/secret\`""`;

const DOCTOR_SKIP = `if [[ "$ENVSEC_E2E_ISOLATED" == "1" ]]; then
  echo "  ⚠ Skipping doctor tests with the isolated credential-store fixture"
elif [[ "$OSTYPE" == "linux-gnu"* ]] && [[ -n "\${CI:-}" ]]; then
  echo "  ⚠ Skipping doctor tests on Linux CI (known to hang in GitHub Actions)"
else
  # ... doctor assertions
fi`;

const DOCTOR_PROBE = `// packages/cli/src/cli/doctor.ts, Linux branch (trimmed)
const setR = await exec("secret-tool", [
  "store", "--label", "envsec doctor probe",
  "service", testService, "account", testAccount,
]);
// secret-tool store reads from stdin — we can't easily pipe here,
// so just check if the tool is callable`;

const SETUP_ACTION = `# .github/actions/setup-and-build/action.yml (trimmed)
inputs:
  node-version:
    default: "24"
  registry-url:
    default: ""

runs:
  using: composite
  steps:
    - uses: actions/setup-node@v7
      with:
        node-version: \${{ inputs.node-version }}
        registry-url: \${{ inputs.registry-url || '' }}
    - uses: pnpm/action-setup@v6
    - name: Install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile
    - name: Build
      shell: bash
      run: pnpm run build`;

const TestingKeychainsInCiPost = () => (
  <PostLayout
    lead={
      <p>
        If your tool stores secrets in the operating system&apos;s credential
        store, the code you most need to test is the code that talks to a system
        service. CI runners don&apos;t give you that service ready to use, and
        on your own laptop you don&apos;t want a test suite writing into your
        real keychain.
      </p>
    }
    slug={SLUG}
  >
    <P>
      envsec keeps secret values in the macOS Keychain, in the Linux Secret
      Service (through <Mono>secret-tool</Mono>) and in the Windows Credential
      Manager, and the metadata about them in a SQLite file. Each of those three
      adapters shells out to a different program with different quoting rules
      and different failure modes. This post describes how the test suite
      reaches all three on GitHub Actions, what I had to set up on each runner,
      and the failures that taught me the most.
    </P>

    <H2>Three layers of tests</H2>
    <P>The tests are split by how much of the real system they touch:</P>
    <List>
      <li>
        <Strong>Unit and contract tests</Strong> run with{" "}
        <Mono>node --test</Mono> in <Mono>core</Mono>, <Mono>sdk</Mono> and{" "}
        <Mono>cli</Mono>. The core tests provide an in-memory{" "}
        <Mono>KeychainAccess</Mono> layer (a <Mono>Map</Mono>) and a real SQLite
        file in a temporary directory. The CLI smoke tests spawn the built{" "}
        <Mono>dist/main.js</Mono> with <Mono>--db</Mono> pointing at a temporary
        file and stick to commands that never reach the keychain.
      </li>
      <li>
        <Strong>The end-to-end script</Strong>,{" "}
        <Mono>packages/cli/test/e2e-test.sh</Mono>, walks through the whole CLI:
        add, get, list, search, env files, load, delete, run, saved commands,
        expiry and audit, GPG sharing, rename, move, copy, doctor, completions,
        shell, secret generation and rescue. <Mono>e2e-test.ps1</Mono> mirrors
        it for Windows.
      </li>
      <li>
        <Strong>The same script against the real credential store</Strong>,
        which is what CI runs on macOS, Ubuntu and Windows.
      </li>
    </List>
    <P>
      The last two are one script with two modes. Without{" "}
      <Mono>ENVSEC_E2E_CLI</Mono>, it runs an alternative entry point that
      replaces only the credential store with a JSON file. With it, it runs the
      real CLI:
    </P>
    <CodeBlock code={MODE_SWITCH} language="bash" />
    <P>
      Because envsec is built from Effect services, the isolated entry point
      doesn&apos;t mock anything clever. It builds the same{" "}
      <Mono>SecretStore</Mono> layer the CLI uses, with the real SQLite metadata
      store and a file-backed <Mono>KeychainAccess</Mono>, and hands it to the
      same runner:
    </P>
    <CodeBlock code={FILE_KEYCHAIN} language="ts" />
    <P>
      So the default <Mono>pnpm --filter envsec test</Mono> never touches the
      keychain on my machine. Exercising the native adapter is an explicit
      opt-in:
    </P>
    <TerminalBlock code={RUN_LOCALLY} />

    <H2>Isolating the metadata database</H2>
    <P>
      The SQLite file is the easy half. Every run points <Mono>ENVSEC_DB</Mono>{" "}
      at a fresh <Mono>mktemp -d</Mono> directory and a trap removes it on exit,
      so a test can never read or damage the real{" "}
      <Mono>~/.envsec/store.sqlite</Mono>.
    </P>
    <P>
      The credential store is shared, though. A temporary database doesn&apos;t
      give you a temporary keychain, which is why every test secret lives under
      a dedicated <Mono>test.e2e*</Mono> context, and why{" "}
      <Mono>cleanup_secrets</Mono> runs both before the first test and from the
      exit trap. A run that crashed halfway leaves entries behind; the next run
      deletes them before it starts.
    </P>
    <P>
      Isolation is also only as good as every line that touches the variable.
      The Windows script once tested a custom database path and then reset{" "}
      <Mono>$env:ENVSEC_DB</Mono> to <Mono>$null</Mono>. Everything after that
      point quietly fell back to the default database in the runner&apos;s home
      directory. It surfaced as a Windows-only failure, and the fix was to
      restore the primary temporary path instead of clearing it.
    </P>

    <H2>Giving each runner a credential store</H2>

    <H3>macOS</H3>
    <P>
      Nothing to set up. The workflow has no keychain step for macOS: the tests
      call the CLI, which calls <Mono>security add-generic-password</Mono> and
      friends against the runner user&apos;s default keychain.
    </P>

    <H3>Linux</H3>
    <P>
      <Mono>secret-tool</Mono> talks to a Secret Service provider over the D-Bus
      session bus. A headless Ubuntu runner doesn&apos;t come with either one
      running, so the workflow installs GNOME Keyring and starts both:
    </P>
    <CodeBlock code={LINUX_KEYRING} language="yaml" />
    <P>Three details matter here:</P>
    <List>
      <li>
        <Mono>dbus-launch --sh-syntax</Mono> prints shell assignments for the
        new bus. Each GitHub Actions step is a new shell, so the address is
        written to <Mono>$GITHUB_ENV</Mono>, where the later test step picks it
        up.
      </li>
      <li>
        <Mono>gnome-keyring-daemon --unlock</Mono> reads a password from stdin
        and uses it to unlock the login keyring, creating it if it doesn&apos;t
        exist. The password is <Mono>test</Mono> because this keyring lives for
        one job.
      </li>
      <li>
        <Mono>--components=secrets</Mono> starts only the Secret Service part,
        not the SSH or PKCS#11 agents.
      </li>
    </List>

    <H3>Windows</H3>
    <P>
      Also nothing to set up: the Credential Manager is there for the runner
      user. envsec reaches it from PowerShell by calling the Win32{" "}
      <Mono>CredWriteW</Mono>, <Mono>CredReadW</Mono> and{" "}
      <Mono>CredDeleteW</Mono> functions through P/Invoke.
    </P>

    <H3>One test, three native commands</H3>
    <P>
      The test I find most useful deletes a secret behind envsec&apos;s back,
      leaving its metadata orphaned, and then checks that <Mono>get</Mono> fails
      with a message that suggests <Mono>envsec delete</Mono>, and that{" "}
      <Mono>delete</Mono> cleans up. Simulating an out-of-band deletion needs
      each platform&apos;s own tool:
    </P>
    <CodeBlock code={STALE_DELETE} language="bash" />
    <P>And on Windows, from PowerShell:</P>
    <CodeBlock code={STALE_DELETE_PS} language="powershell" />

    <H2>What broke, and why</H2>
    <P>
      Most of what I learned came from differences between operating systems
      rather than from regressions. A few examples:
    </P>

    <H3>Shell quoting on Windows</H3>
    <P>
      The first Windows adapter shelled out to <Mono>cmdkey</Mono> through
      nested shells. A value like <Mono>p@ss w0rd!#$%</Mono> did not survive the
      trip, and my first reaction was to change the Windows test value to{" "}
      <Mono>p@ssw0rd_S3cr3t</Mono> so it would pass. That made the test green
      and the bug invisible. The real fix came a day later: the adapter moved to
      P/Invoke, and the test went back to the same special characters the Unix
      script uses.
    </P>

    <H3>Non-ASCII values on macOS</H3>
    <P>
      An emoji or an accented character came back from <Mono>security</Mono> as
      hex. Rather than decode per platform, envsec now base64-encodes every
      value before handing it to the credential store, with an{" "}
      <Mono>envsec:b64:</Mono> prefix, and decodes it on the way out. The E2E
      suite stores <Mono>hello ⭐ world 🚀</Mono> and{" "}
      <Mono>café résumé naïve</Mono> on all three systems to keep it that way.
    </P>

    <H3>The test tools themselves</H3>
    <P>
      One macOS failure had nothing to do with envsec: a check used{" "}
      <Mono>grep -P</Mono>, which the BSD <Mono>grep</Mono> on macOS
      doesn&apos;t support. On Windows, the GPG share tests are skipped: the{" "}
      <Mono>gpg</Mono> on the runner is an MSYS2 build that rewrites{" "}
      <Mono>GNUPGHOME</Mono> from a Windows path into a broken Unix-style one.
      Sharing is tested on macOS and Linux only.
    </P>

    <H3>The doctor hang on Linux</H3>
    <P>
      When I added <Mono>envsec doctor</Mono>, the Ubuntu E2E job stopped
      finishing. One run sat for more than 13 minutes before it was cancelled. I
      skipped the doctor tests on Linux CI and moved on:
    </P>
    <CodeBlock code={DOCTOR_SKIP} language="bash" />
    <P>
      That is a skip, not a fix, and it is still there. Rereading the code for
      this post, I think I know the cause. The Linux branch of the read/write
      probe runs <Mono>secret-tool store</Mono>, which reads the secret from
      stdin when stdin isn&apos;t a terminal, but never writes to stdin or
      closes it:
    </P>
    <CodeBlock code={DOCTOR_PROBE} language="ts" />
    <P>
      Node&apos;s <Mono>execFile</Mono> gives the child an open stdin pipe, so a
      program that reads until end of file waits forever. The real Linux adapter
      does write the value and close stdin, which is why the rest of the Linux
      suite doesn&apos;t hang. If this is right, the hang isn&apos;t specific to
      CI, and the honest fix is in <Mono>doctor</Mono>, not in the test script.
    </P>
    <P>
      The broader lesson is about timeouts. Neither workflow sets{" "}
      <Mono>timeout-minutes</Mono>, so a hung job runs until someone cancels it
      or GitHub&apos;s default job limit ends it. The CLI smoke tests do better:
      the test for a prompt that gets no input spawns the CLI with a 10-second
      timeout and asserts that it exited with an error instead of being killed.
      The E2E script also ends by checking that no <Mono>dist/main.js</Mono>{" "}
      process is still running.
    </P>

    <H2>One setup action for every job</H2>
    <P>
      Every job needs the same preparation: Node, pnpm, a frozen-lockfile
      install and a build. I moved it into a composite action so the E2E matrix,
      the CI checks and the release jobs can&apos;t drift apart:
    </P>
    <CodeBlock code={SETUP_ACTION} language="yaml" />
    <P>
      The <Mono>registry-url</Mono> input exists for the npm publish job; the
      default Node version moved from 22 to 24 in one place. The trade-off is
      that <Mono>pnpm run build</Mono> runs <Mono>turbo run build</Mono> for the
      whole monorepo, website included, even in jobs that only need the CLI.
    </P>
    <P>The workflows that use it are split by cost:</P>
    <List>
      <li>
        <Mono>ci.yml</Mono> runs on every push and pull request to{" "}
        <Mono>main</Mono> and <Mono>beta</Mono>, on Ubuntu only: Ultracite
        (Oxlint and Oxfmt), typecheck, unit tests, and a compiled-binary smoke
        test with <Mono>node_modules</Mono> deleted.
      </li>
      <li>
        <Mono>e2e.yml</Mono> runs the native suite on <Mono>macos-latest</Mono>,{" "}
        <Mono>ubuntu-24.04</Mono> and <Mono>windows-latest</Mono>, only when
        something under <Mono>packages/</Mono> or the workspace config changes.
        The matrix sets <Mono>fail-fast: false</Mono>, so a Linux failure
        doesn&apos;t cancel the macOS run that would have told me whether the
        bug is platform-specific.
      </li>
    </List>
    <P>
      The Ubuntu runners are pinned to <Mono>ubuntu-24.04</Mono> rather than{" "}
      <Mono>ubuntu-latest</Mono>, because the keyring packages above are exactly
      the kind of thing a new image can break without notice.
    </P>

    <H2>What this does not cover</H2>
    <List>
      <li>
        The E2E suite runs <Mono>dist/main.js</Mono> on Node. The standalone Bun
        binaries get smoke tests that avoid the keychain, not the full suite
        (more on that in{" "}
        <Link className={LINK_CLASS} href="/blog/shipping-a-bun-binary">
          Shipping one CLI to Homebrew, npm, mise and a standalone binary
        </Link>
        ).
      </li>
      <li>
        Linux is tested against GNOME Keyring only, not KWallet or other Secret
        Service providers.
      </li>
      <li>
        The keychains in CI are always unlocked and never show a permission
        dialog, so prompts and locked-keychain errors are not covered by CI.
      </li>
      <li>
        <Mono>doctor</Mono> is untested on Linux, and <Mono>share</Mono> is
        untested on Windows.
      </li>
    </List>

    <H2>In short</H2>
    <P>
      Run the same end-to-end script in two modes: a file-backed keychain for
      day-to-day work, the real one in CI. Give every run its own database, keep
      test secrets in their own contexts, and clean them before and after. On
      Linux, start a D-Bus session and unlock GNOME Keyring yourself; macOS and
      Windows need nothing. And when a platform-specific test fails, be
      suspicious of the fix that only changes the test. The adapters themselves
      are described in{" "}
      <Link className={LINK_CLASS} href="/blog/one-cli-three-keychains">
        One CLI, three keychains
      </Link>
      , and the workflows are in the{" "}
      <ExternalLink href="https://github.com/davidnussio/envsec/tree/main/.github">
        envsec repository
      </ExternalLink>
      .
    </P>
  </PostLayout>
);

export default TestingKeychainsInCiPost;
