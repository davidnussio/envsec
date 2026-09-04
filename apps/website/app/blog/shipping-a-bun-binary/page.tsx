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

const SLUG = "shipping-a-bun-binary";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const TAG_VERSION = `\${GITHUB_REF_NAME#v}`;

const BUILD_BIN = `// packages/cli/scripts/build-bin.ts (trimmed)
const defines = [
  \`--define=ENVSEC_VERSION=\${JSON.stringify(pkg.version)}\`,
  \`--define=EFFECT_VERSION=\${JSON.stringify(effectPkg.version)}\`,
];

await Bun.$\`bun build \${entry} --compile --minify --sourcemap \\
  \${targetFlag} \${defines} --outfile \${outfile}\`;`;

const BINARIES_JOB = `binaries:
  strategy:
    matrix:
      include:
        - os: ubuntu-24.04
          targets: bun-linux-x64 bun-linux-arm64 bun-linux-x64-musl bun-linux-arm64-musl
          smoke: envsec-linux-x64
        - os: macos-latest
          targets: bun-darwin-arm64 bun-darwin-x64
          smoke: envsec-darwin-arm64
        - os: windows-latest
          targets: bun-windows-x64
          smoke: envsec-windows-x64.exe
  runs-on: \${{ matrix.os }}
  steps:
    # ...checkout, version from tag, setup-and-build, Bun 1.4.2
    - name: Compile
      shell: bash
      run: pnpm -F envsec run build:bin \${{ matrix.targets }}

    - name: Ad-hoc sign (macOS)
      if: runner.os == 'macOS'
      run: |
        for f in packages/cli/release/envsec-darwin-*; do
          [[ "$f" == *.map ]] && continue
          codesign --force --sign - "$f"
          codesign --verify --verbose "$f"
        done

    - name: Smoke test
      shell: bash
      run: |
        BIN="packages/cli/release/\${{ matrix.smoke }}"
        export ENVSEC_DB="$RUNNER_TEMP/smoke/store.sqlite"
        "$BIN" --version | grep -qF "\${GITHUB_REF_NAME#v}"
        "$BIN" cmd list`;

const CI_SMOKE = `# node_modules is removed first: the binary must not read anything
# from the build tree at run time (e.g. a WASM file or package.json).
- name: Smoke test without Node.js or node_modules
  run: |
    BIN="$RUNNER_TEMP/envsec"
    cp packages/cli/release/envsec "$BIN"
    rm -rf node_modules packages/*/node_modules
    HOME="$(mktemp -d)"
    export HOME
    export PATH="/usr/bin:/bin"
    "$BIN" --version | grep -q "$(jq -r .version packages/cli/package.json)"
    "$BIN" -c ci run --save --name hello "echo hi" | grep -q hi
    "$BIN" cmd list | grep -q hello
    "$BIN" cmd delete hello
    test "$(stat -c %a "$HOME/.envsec/store.sqlite")" = 600`;

const PACKAGE_ASSETS = `# Asset names carry no version, so releases/latest/download/<asset> is a
# stable URL. Artifacts lose the executable bit: it is restored here.
for f in bin/envsec-*; do
  # ...
  if [[ "$name" == *.exe ]]; then
    cp "$f" "$stage/envsec.exe"
    (cd "$stage" && zip -q "$OUT/envsec-\${target}.zip" envsec.exe LICENSE README.md)
  else
    install -m 755 "$f" "$stage/envsec"
    tar -C "$stage" -czf "$OUT/envsec-\${target}.tar.gz" envsec LICENSE README.md
  fi
done
(cd "$OUT" && sha256sum envsec-* > SHA256SUMS)`;

const INSTALL_BINARY = `# or darwin-x64, linux-x64, linux-arm64, linux-x64-musl, linux-arm64-musl
TARGET=darwin-arm64
curl -fsSL "https://github.com/davidnussio/envsec/releases/latest/download/envsec-\${TARGET}.tar.gz" | tar -xz envsec
sudo mv envsec /usr/local/bin/`;

const OLD_FORMULA = `# release.yml, March 2026 (trimmed)
- name: Wait for npm registry propagation
  run: sleep 30
# ...
# Retry download until npm has propagated the package
for i in 1 2 3 4 5; do
  HTTP_CODE=$(curl -sL -o envsec.tgz -w "%{http_code}" "$URL")
  if [ "$HTTP_CODE" = "200" ]; then
    break
  fi
  echo "Attempt $i: got HTTP $HTTP_CODE, retrying in 15s..."
  sleep 15
done`;

const FORMULA = `# Formula/envsec.rb in davidnussio/homebrew-tap (trimmed)
class Envsec < Formula
  desc "Secure environment secrets management using native OS credential stores"
  homepage "https://github.com/davidnussio/envsec"
  version "1.1.2"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/davidnussio/envsec/releases/download/v1.1.2/envsec-darwin-arm64.tar.gz"
      sha256 "<from SHA256SUMS>"
    end
    # on_intel: envsec-darwin-x64.tar.gz
  end
  # on_linux: envsec-linux-arm64 / envsec-linux-x64

  def install
    bin.install "envsec"
    generate_completions_from_executable(bin/"envsec", "--completions", shells: [:bash, :zsh, :fish])
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/envsec --version")
    shell_output("ENVSEC_DB=#{testpath}/store.sqlite #{bin}/envsec cmd list")
  end
end`;

const HOMEBREW_TEST = `homebrew-test:
  needs: homebrew-formula
  strategy:
    matrix:
      os: [macos-latest, ubuntu-24.04, ubuntu-24.04-arm]
  steps:
    # ...download the generated formula, install Homebrew on Linux
    - run: |
        brew tap-new --no-git envsec/release-test
        cp "$FORMULA.rb" "$(brew --repository envsec/release-test)/Formula/"
        brew install "envsec/release-test/$FORMULA"
        brew test "envsec/release-test/$FORMULA"
        envsec --version
        test -f "$(brew --prefix)/share/zsh/site-functions/_envsec"`;

const NPM_CHECK = `# Fail before publishing anything, so a release is never half-published.
# npm's \`time\` field also lists versions that were published and later
# unpublished: npm never allows reusing those numbers either.
- name: Check that no version is already taken on npm
  run: |
    VERSION="\${{ steps.version.outputs.version }}"
    for pkg in @envsec/core @envsec/sdk @envsec/tui envsec; do
      if npm view "$pkg" time --json 2>/dev/null | node -e '
        const t = JSON.parse(require("fs").readFileSync(0, "utf8") || "{}");
        process.exit(Object.hasOwn(t, process.argv[1]) ? 0 : 1);
      ' "$VERSION"; then
        echo "::error::$pkg@$VERSION is already taken on npm"
        exit 1
      fi
    done`;

const DIST_TAG = `# Determine npm dist-tag: only stable versions become "latest"
if [[ "$VERSION" == *"-alpha"* ]]; then
  echo "tag=alpha" >> "$GITHUB_OUTPUT"
elif [[ "$VERSION" == *"-beta"* ]]; then
  echo "tag=beta" >> "$GITHUB_OUTPUT"
elif [[ "$VERSION" == *"-"* ]]; then
  echo "tag=next" >> "$GITHUB_OUTPUT"
else
  echo "tag=latest" >> "$GITHUB_OUTPUT"
fi`;

const BETA_INSTALL = `npm install -g envsec@beta

# if the stable formula is installed
brew uninstall envsec
brew install davidnussio/tap/envsec-beta`;

const COST_COLUMNS = [
  { label: "" },
  { label: "npm package on Node" },
  { highlight: true, label: "Bun binary" },
] as const;

const COST_ROWS = [
  ["envsec --version (median)", "192.3 ms", "32.4 ms"],
  ["Peak memory, envsec list", "97 MB", "36 MB"],
  ["Download", "~10 MB", "25 MB (tar.gz)"],
  ["Disk footprint", "58 MB", "61 MB (runtime incl.)"],
  ["Needs Node.js", "yes (≥ 22.13)", "no"],
] as const;

const ShippingBunBinaryPost = () => (
  <PostLayout
    lead={
      <p>
        A command-line tool written in TypeScript has an awkward install story.
        People who live in Node want <Mono>npm install -g</Mono>. Everyone else
        wants <Mono>brew install</Mono> or a single file they can drop on their{" "}
        <Mono>PATH</Mono>, and shouldn&apos;t need a JavaScript runtime to get
        it.
      </p>
    }
    slug={SLUG}
  >
    <P>
      envsec ships through all of those: a standalone binary built with{" "}
      <Mono>bun build --compile</Mono>, a Homebrew formula that installs it, the
      npm package, <Mono>npx</Mono>, and mise through its npm backend. This post
      walks through the one workflow that produces all of them, with the parts I
      got wrong along the way and the parts that are still missing.
    </P>

    <H2>One tag, one workflow</H2>
    <P>
      Everything starts when I publish a GitHub release. The workflow listens
      for <Mono>published</Mono>, not <Mono>created</Mono>, so saving a draft
      release doesn&apos;t publish anything. The version is the tag without its{" "}
      <Mono>v</Mono> (<Mono>{TAG_VERSION}</Mono>), and the workflow writes it
      into all four <Mono>package.json</Mono> files itself.
    </P>
    <P>
      Changesets is in the repository, but it doesn&apos;t drive the release: I
      use it to collect changelog entries and <Mono>changeset version</Mono> to
      fold them into each <Mono>CHANGELOG.md</Mono>. The tag decides the
      version, and after publishing, the workflow commits the bump back to{" "}
      <Mono>main</Mono> for stable releases or <Mono>beta</Mono> for
      prereleases.
    </P>
    <P>The jobs run in this order, each one gated on the previous:</P>
    <OrderedList>
      <li>
        <Strong>binaries</Strong>: compile, sign and smoke-test on Linux, macOS
        and Windows runners.
      </li>
      <li>
        <Strong>publish</Strong>: check versions, then publish{" "}
        <Mono>@envsec/core</Mono>, <Mono>@envsec/sdk</Mono>,{" "}
        <Mono>@envsec/tui</Mono> and <Mono>envsec</Mono> to npm.
      </li>
      <li>
        <Strong>attach-binaries</Strong>: package archives and{" "}
        <Mono>SHA256SUMS</Mono> and upload them to the GitHub release.
      </li>
      <li>
        <Strong>homebrew-formula</Strong>, <Strong>homebrew-test</Strong>,{" "}
        <Strong>update-homebrew</Strong>: generate the formula, install it for
        real, then push it to the tap.
      </li>
    </OrderedList>
    <P>
      Binaries come first on purpose: a binary that fails its smoke test blocks
      the npm publish too. For 1.1.2, the whole run took a little over four
      minutes.
    </P>

    <H2>Compiling with bun build --compile</H2>
    <P>
      A small script, <Mono>build-bin.ts</Mono>, wraps the compiler. It accepts
      seven targets: <Mono>bun-darwin-arm64</Mono>, <Mono>bun-darwin-x64</Mono>,{" "}
      <Mono>bun-linux-x64</Mono>, <Mono>bun-linux-arm64</Mono>, their two{" "}
      <Mono>-musl</Mono> variants, and <Mono>bun-windows-x64</Mono>.
    </P>
    <CodeBlock code={BUILD_BIN} language="ts" />
    <P>
      The <Mono>--define</Mono> flags exist because the compiled binary has no{" "}
      <Mono>package.json</Mono> to read at run time. On Node,{" "}
      <Mono>build-info.ts</Mono> reads the version from the package; in the
      binary, Bun inlines it at compile time. That is also why the release job
      runs <Mono>npm pkg set version=…</Mono> from the tag before building.
    </P>
    <P>
      Bun cross-compiles, so one runner per operating system is enough. Each
      runner builds its family of targets and runs only the one that matches its
      own platform:
    </P>
    <CodeBlock code={BINARIES_JOB} language="yaml" />
    <P>
      The smoke test points <Mono>ENVSEC_DB</Mono> at a temporary file and runs{" "}
      <Mono>cmd list</Mono>, which reads the SQLite metadata but never the
      keychain. The CI workflow is stricter about the build tree: on every push
      to main or beta and on every pull request, it compiles the binary, deletes
      every <Mono>node_modules</Mono>, strips <Mono>PATH</Mono> down to{" "}
      <Mono>/usr/bin:/bin</Mono> and runs it from a fresh <Mono>HOME</Mono>:
    </P>
    <CodeBlock code={CI_SMOKE} language="yaml" />
    <P>
      The comment names the failure it guards against. Before the metadata store
      moved to <Mono>node:sqlite</Mono>, it used <Mono>sql.js</Mono>, and the
      compiled binary couldn&apos;t locate its WASM file. The last line checks
      that the database is still created with mode <Mono>600</Mono>.
    </P>

    <H3>macOS: signed ad hoc, not notarized</H3>
    <P>
      Both macOS binaries are re-signed with <Mono>codesign --sign -</Mono>, an
      ad-hoc signature. Apple Silicon refuses to run arm64 code that has no
      valid signature at all, and an ad-hoc one is enough for that. It is not a
      Developer ID signature, and the binaries are not notarized.
    </P>
    <P>
      In practice that works for the documented install paths. Homebrew
      doesn&apos;t quarantine what a formula installs, and the README installs
      the binary with <Mono>curl</Mono>, which doesn&apos;t set the quarantine
      attribute either. If you download the archive with a browser instead,
      macOS marks it as quarantined, Gatekeeper blocks un-notarized quarantined
      binaries, and nothing in the README tells you what to do about it yet.
    </P>

    <H2>Release assets with stable URLs</H2>
    <P>
      The <Mono>attach-binaries</Mono> job collects the artifacts from the three
      runners and packages them:
    </P>
    <CodeBlock code={PACKAGE_ASSETS} language="bash" />
    <P>
      Uploading and downloading through GitHub artifacts drops the executable
      bit, hence <Mono>install -m 755</Mono>. And archive names without a
      version mean the install command never changes:
    </P>
    <TerminalBlock code={INSTALL_BINARY} />
    <P>
      On Windows the asset is <Mono>envsec-windows-x64.zip</Mono>, and you put{" "}
      <Mono>envsec.exe</Mono> on your <Mono>PATH</Mono> yourself.
    </P>

    <H2>Homebrew: generate, install, then push</H2>
    <P>
      The first formula, in March, wrapped the npm tarball and declared{" "}
      <Mono>depends_on &quot;node&quot;</Mono>. Its update job ran right after
      the npm publish, when the new tarball might not be downloadable yet, so it
      got a wait and a retry loop:
    </P>
    <CodeBlock code={OLD_FORMULA} language="yaml" />
    <P>
      A day later it learned to generate shell completions. Now that the
      binaries exist, the formula installs them directly, so there is nothing on
      npm to wait for and no Node dependency. It is generated from the
      release&apos;s <Mono>SHA256SUMS</Mono>, with one URL per platform.
      Trimmed, the stable formula looks like this:
    </P>
    <CodeBlock code={FORMULA} language="ruby" />
    <P>
      <Mono>generate_completions_from_executable</Mono> runs{" "}
      <Mono>envsec --completions bash</Mono> (and zsh, fish) at install time, so
      the completions always match the installed version. The formula covers
      macOS and glibc Linux on arm64 and x64; the musl builds are release assets
      only.
    </P>
    <P>
      The formula is installed and tested before it reaches the tap. Each of
      three runners creates a throwaway local tap, installs from it and runs{" "}
      <Mono>brew test</Mono>:
    </P>
    <CodeBlock code={HOMEBREW_TEST} language="yaml" />
    <P>
      Only if all three pass does <Mono>update-homebrew</Mono> commit the file
      to <Mono>davidnussio/homebrew-tap</Mono>. The{" "}
      <Mono>ubuntu-24.04-arm</Mono> runner is also the only place where the
      Linux arm64 binary is actually executed before users get it.
    </P>

    <H2>npm: a check born from a failed release</H2>
    <P>
      The 1.0.0 release published <Mono>@envsec/core</Mono>,{" "}
      <Mono>@envsec/sdk</Mono> and <Mono>@envsec/tui</Mono>, then failed on the
      CLI. An earlier, unrelated package called <Mono>envsec</Mono> had once
      published and unpublished 1.0.0, 1.0.1, 1.1.0 and 1.1.1, and npm never
      lets you reuse a version number. I had a half-published release and
      shipped 1.0.2 instead.
    </P>
    <P>The publish job now checks all four packages before touching any:</P>
    <CodeBlock code={NPM_CHECK} language="yaml" />
    <P>
      It paid off at 1.1.0: the workflow stopped at this step with nothing
      published to npm or Homebrew, and the release went out as 1.1.2. The check
      doesn&apos;t make the four publishes atomic, though. If the third{" "}
      <Mono>pnpm publish</Mono> fails for any other reason, the first two are
      already out. npm also goes before the GitHub assets, so a failure while
      attaching them leaves npm ahead of the release page.
    </P>

    <H3>The beta channel</H3>
    <P>
      Prereleases pick their npm dist-tag from the version, so only stable
      versions ever become <Mono>latest</Mono>:
    </P>
    <CodeBlock code={DIST_TAG} language="bash" />
    <P>
      A <Mono>-beta</Mono> release also updates a separate{" "}
      <Mono>envsec-beta</Mono> formula, which declares{" "}
      <Mono>conflicts_with &quot;envsec&quot;</Mono> because both install an{" "}
      <Mono>envsec</Mono> command. I wanted <Mono>envsec@beta</Mono>, but
      Homebrew needs a digit after the <Mono>@</Mono> to build the class name.
      Alpha and rc releases stay on npm only.
    </P>
    <TerminalBlock code={BETA_INSTALL} />

    <H2>Why the npm package still exists</H2>
    <P>
      mise installs envsec with <Mono>mise use -g npm:envsec</Mono>, which goes
      through the npm package, and so does <Mono>npx envsec</Mono>. Both need
      Node 22.13 or newer, because the metadata store uses the built-in{" "}
      <Mono>node:sqlite</Mono> module. If you already have Node, the npm package
      is the smaller download. And <Mono>@envsec/core</Mono> and{" "}
      <Mono>@envsec/sdk</Mono> are libraries, so npm is where they belong
      anyway.
    </P>

    <H2>What the binary costs</H2>
    <P>
      I measured both forms of the 1.1.0-beta.1 release on an Apple M4 Pro for{" "}
      <Link className={LINK_CLASS} href="/blog/effect-4-bun-performance">
        From 417 to 32 milliseconds
      </Link>
      . The relevant numbers from that post:
    </P>
    <DataTable
      caption="darwin-arm64, envsec 1.1.0-beta.1, npm package on Node.js 26.10.0. Startup: median of 40 runs; memory: median of 15 runs."
      columns={COST_COLUMNS}
      rows={COST_ROWS}
    />
    <P>
      Of the binary&apos;s 61 MB, about 59 are the Bun runtime; envsec and its
      dependencies are just over 1.5 MB. You pay for the runtime once per
      install, and you get a startup about six times faster and no dependency on
      whatever Node version is on the machine.
    </P>

    <H2>What&apos;s still missing</H2>
    <List>
      <li>
        No notarization or Developer ID signature on macOS, and no workaround
        documented for browser downloads.
      </li>
      <li>
        <Mono>SHA256SUMS</Mono> is not signed, and the npm packages are
        published without provenance.
      </li>
      <li>
        The <Mono>darwin-x64</Mono> and musl binaries are compiled but never
        executed in CI.
      </li>
      <li>
        No Windows package manager: the zip on the release page is the only
        option without Node.
      </li>
      <li>The four npm publishes are not atomic.</li>
    </List>

    <H2>In short</H2>
    <P>
      One tag drives everything. Bun compiles seven targets on three runners,
      each runner smoke-tests its own binary, and nothing is published until
      they pass. npm gets a version check that exists because of a real failed
      release. Homebrew gets a formula that is installed and tested on three
      runners before it reaches the tap. The npm package stays for Node users,
      npx and mise. How CI tests the keychain adapters themselves is in{" "}
      <Link className={LINK_CLASS} href="/blog/testing-keychains-in-ci">
        Testing a keychain CLI on macOS, Linux and Windows in CI
      </Link>
      , and the full workflow is{" "}
      <ExternalLink href="https://github.com/davidnussio/envsec/blob/main/.github/workflows/release.yml">
        release.yml on GitHub
      </ExternalLink>
      .
    </P>
  </PostLayout>
);

export default ShippingBunBinaryPost;
