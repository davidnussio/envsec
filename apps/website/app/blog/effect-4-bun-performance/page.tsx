import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  BarChart,
  DataTable,
  ExternalLink,
  H2,
  H3,
  Mono,
  OrderedList,
  P,
  Strong,
  List,
} from "@/components/blog/prose";
import { CodeBlock } from "@/components/code-block";
import { TerminalBlock } from "@/components/terminal-block";

const SLUG = "effect-4-bun-performance";

export const metadata = postMetadata(SLUG);

const VARIANTS = [
  { label: "" },
  { label: "Effect 3 · Node (1.0.0-beta.18)" },
  { label: "Effect 4 · Node (1.0.2)" },
  { label: "Effect 4 · Node (1.1.0-beta.1)" },
  { highlight: true, label: "Effect 4 · Bun binary (1.1.0-beta.1)" },
] as const;

const SUMMARY_ROWS = [
  ["envsec --version", "416.7 ms", "318.2 ms", "192.3 ms", "32.4 ms"],
  ["envsec --help", "430.1 ms", "324.2 ms", "196.8 ms", "34.0 ms"],
  ["envsec list", "443.4 ms", "319.2 ms", "199.4 ms", "33.7 ms"],
  ["Memory (max RSS, list)", "207 MB", "154 MB", "97 MB", "36 MB"],
  ["Installed packages", "42", "19", "10", "0 (single file)"],
  ["Disk footprint", "106 MB", "100 MB", "58 MB", "61 MB (runtime incl.)"],
  ["Minified JS bundle", "516 KB", "371 KB", "371 KB", "embedded"],
] as const;

const INSTALL_COLUMNS = [
  { label: "" },
  { label: "Effect 3 · npm" },
  { label: "Effect 4 · npm 1.0.2" },
  { label: "Effect 4 · npm 1.1.0-beta.1" },
  { highlight: true, label: "Bun binary" },
] as const;

const INSTALL_ROWS = [
  ["npm install, cold cache (median of 3)", "3.0 s", "2.0 s", "1.6 s", "—"],
  ["Download (compressed)", "~23 MB", "~21 MB", "~10 MB", "25 MB (tar.gz)"],
  ["Needs Node.js", "yes", "yes", "yes (≥ 22.13)", "no"],
] as const;

const STARTUP_STEPS = [
  { label: "Effect 3 · Node", value: 417 },
  { label: "Effect 4 · Node", note: "−99 ms", value: 318 },
  { label: "Effect 4 · leaner deps", note: "−126 ms", value: 192 },
  {
    highlight: true,
    label: "Effect 4 · Bun binary",
    note: "−160 ms",
    value: 32,
  },
] as const;

const MEMORY_STEPS = [
  { label: "Effect 3 · Node", value: 207 },
  { label: "Effect 4 · Node", value: 154 },
  { label: "Effect 4 · leaner deps", value: 97 },
  { highlight: true, label: "Effect 4 · Bun binary", value: 36 },
] as const;

const BENCH_COMMAND = `export ENVSEC_DB=$PWD/db/store.sqlite && mkdir -p db
hyperfine -N --warmup 5 --runs 40 \\
  -n "Effect 3" "effect3/node_modules/.bin/envsec list" \\
  -n "Effect 4" "effect4/node_modules/.bin/envsec list" \\
  -n "Bun"      "./envsec list"`;

const EffectBunPerformancePost = () => (
  <PostLayout
    lead={
      <p>
        envsec is a CLI: you run it, it does one thing, and it exits. You run it
        dozens of times a day, sometimes inside a script or a shell prompt. For
        a tool like that, startup time is the performance that matters, because
        it is the only one you actually feel.
      </p>
    }
    slug={SLUG}
  >
    <P>
      The new beta (<Mono>1.1.0-beta.1</Mono>) wraps up a three-step journey:
      migrating from Effect 3 to Effect 4, trimming dependencies, and shipping a
      standalone binary built with <Mono>bun build --compile</Mono>. I measured
      every step on the same machine. The result:{" "}
      <Strong>
        startup went from 417 ms to 32 ms (12.9× faster), and memory from 207 MB
        to 36 MB (5.8× less).
      </Strong>
    </P>

    <H2>At a glance</H2>
    <DataTable
      caption="Times: median of 40 runs after 5 warm-up runs."
      columns={VARIANTS}
      rows={SUMMARY_ROWS}
    />

    <H2>The three steps</H2>

    <H3>1. Effect 3 → Effect 4 (1.0.0-beta.18 → 1.0.2)</H3>
    <P>
      On Effect 3, a CLI like envsec pulled in a constellation of packages:{" "}
      <Mono>effect</Mono>, <Mono>@effect/cli</Mono>,{" "}
      <Mono>@effect/platform</Mono>, <Mono>@effect/platform-node</Mono> and,
      transitively, <Mono>@effect/cluster</Mono>, <Mono>@effect/rpc</Mono>,{" "}
      <Mono>@effect/sql</Mono>, <Mono>@effect/workflow</Mono>,{" "}
      <Mono>@effect/printer</Mono>, <Mono>@effect/typeclass</Mono> and more. 42
      packages in total.
    </P>
    <P>
      Effect 4 folds almost all of that into the <Mono>effect</Mono> package:
      the CLI module is now imported from <Mono>effect/cli</Mono>. The migration
      notes mention a fiber runtime rewritten for lower memory overhead and
      faster execution, and a core built for aggressive tree-shaking. For
      envsec, that meant:
    </P>
    <List>
      <li>
        <Strong>startup: −24%</Strong> (417 → 318 ms)
      </li>
      <li>
        <Strong>memory: −26%</Strong> (207 → 154 MB)
      </li>
      <li>
        <Strong>minified bundle: −28%</Strong> (516 → 371 KB; gzipped 155 → 115
        KB)
      </li>
      <li>
        <Strong>packages: 42 → 19</Strong>
      </li>
    </List>
    <P>
      None of the application logic changed. That gain comes from the library
      upgrade alone.
    </P>

    <H3>2. Leaner dependencies (1.0.2 → 1.1.0-beta.1 on Node)</H3>
    <P>Two targeted changes:</P>
    <List>
      <li>
        <Strong>
          Dropped <Mono>@effect/platform-node</Mono>.
        </Strong>{" "}
        The CLI only needs <Mono>NodeRuntime.runMain</Mono> and{" "}
        <Mono>NodeServices.layer</Mono>, which that package just re-exports from{" "}
        <Mono>@effect/platform-node-shared</Mono>. Its barrel import, however,
        also loaded <Mono>undici</Mono> and the <Mono>redis</Mono> client on
        every start. envsec now imports the <Mono>platform-node-shared</Mono>{" "}
        modules directly.
      </li>
      <li>
        <Strong>
          Replaced <Mono>sql.js</Mono> with <Mono>node:sqlite</Mono>.
        </Strong>{" "}
        The metadata database used SQLite compiled to WebAssembly: a 23 MB
        package and a WASM module to instantiate on every start. It now uses the
        built-in <Mono>node:sqlite</Mono> module (Node ≥ 22.13, also supported
        by Bun). As a bonus, writes go straight to the file instead of
        re-exporting the whole in-memory database each time.
      </li>
    </List>
    <P>
      Result: <Strong>startup 318 → 192 ms (−40%)</Strong>,{" "}
      <Strong>memory 154 → 97 MB</Strong>, <Strong>packages 19 → 10</Strong>,
      and the disk footprint nearly halved.
    </P>

    <H3>3. A standalone Bun binary</H3>
    <CodeBlock code="bun build src/main.ts --compile --minify --sourcemap --outfile envsec" />
    <P>
      <Mono>--compile</Mono> produces a single executable with the Bun runtime
      embedded: no Node.js, no <Mono>node_modules</Mono>, no module resolution
      at startup. The CLI code ships pre-bundled and minified in one file.
    </P>
    <P>
      Result: <Strong>startup 192 → 32 ms (5.9× faster)</Strong>,{" "}
      <Strong>memory 97 → 36 MB</Strong>.
    </P>
    <P>The gain has two sources:</P>
    <OrderedList>
      <li>
        <Strong>The runtime.</Strong> On this machine an empty process takes
        76.5 ms with Node (<Mono>node -e 0</Mono>) and 4.5 ms with Bun (
        <Mono>bun -e 0</Mono>). That alone is worth about 72 ms.
      </li>
      <li>
        <Strong>Loading the code.</Strong> Subtracting the runtime cost, envsec
        on Node spends about 116 ms loading and initialising modules; the binary
        needs about 28. Reading one pre-bundled file is far cheaper than
        resolving and evaluating hundreds of files spread across 10 packages.
      </li>
    </OrderedList>

    <H2>Where the 384 milliseconds went</H2>
    <BarChart
      caption="Median of envsec --version, 40 runs. Each step builds on the previous one."
      data={STARTUP_STEPS}
      title="Startup time"
      unit="ms"
    />
    <BarChart
      caption="Median of 15 runs of envsec list, measured with /usr/bin/time -l."
      data={MEMORY_STEPS}
      title="Peak memory (RSS)"
      unit="MB"
    />
    <P>
      Every step delivered a real gain, and each one enabled the next: without
      the move to <Mono>node:sqlite</Mono> the binary could not even be
      compiled, because the <Mono>sql.js</Mono> WASM file could not be located
      at run time.
    </P>

    <H2>Installation and distribution</H2>
    <DataTable columns={INSTALL_COLUMNS} rows={INSTALL_ROWS} />
    <P>
      The binary is not the lightest download: of its 61 MB, about 59 are the
      Bun runtime, so envsec and its dependencies weigh just over 1.5 MB. In
      exchange you don&apos;t need Node installed, there is no dependency tree
      to resolve, and startup is an order of magnitude faster. The npm package
      is still there for anyone who prefers Node, and it is 54% faster than the
      Effect 3 version too.
    </P>

    <H2>Methodology</H2>
    <List>
      <li>
        <Strong>Machine:</Strong> Apple M4 Pro, 24 GB RAM, macOS (Darwin 27.0)
      </li>
      <li>
        <Strong>Runtimes:</Strong> Node.js v26.10.0 for the npm versions; Bun
        1.4.2 embedded in the binary
      </li>
      <li>
        <Strong>Versions:</Strong> installed from npm (
        <Mono>envsec@1.0.0-beta.18</Mono>, <Mono>@1.0.2</Mono>,{" "}
        <Mono>@1.1.0-beta.1</Mono>). The binary is{" "}
        <Mono>envsec-darwin-arm64</Mono> from the <Mono>v1.1.0-beta.1</Mono>{" "}
        GitHub release.
      </li>
      <li>
        <Strong>Tools:</Strong> <Mono>hyperfine -N --warmup 5 --runs 40</Mono>{" "}
        for timings; <Mono>/usr/bin/time -l</Mono> (median of 15 runs) for
        memory; <Mono>bun build --minify</Mono> of the published{" "}
        <Mono>dist/main.js</Mono> for bundle size (<Mono>sql.js</Mono> excluded,
        since it loads as WASM).
      </li>
      <li>
        <Strong>Data:</Strong> an empty database isolated via{" "}
        <Mono>ENVSEC_DB</Mono>, so the measured commands never touch the system
        keychain.
      </li>
    </List>

    <H3>Caveats</H3>
    <List>
      <li>
        This is one machine. Absolute numbers will differ on Linux and on Node
        24 LTS: in earlier tests on Node 24, removing{" "}
        <Mono>@effect/platform-node</Mono> alone took <Mono>--version</Mono>{" "}
        from ~241 to ~149 ms.
      </li>
      <li>
        I measured startup, not long-running workloads. Commands that read
        secrets are dominated by keychain latency (Keychain, libsecret,
        Credential Manager), which is the same for every version.
      </li>
      <li>
        The binary doesn&apos;t use Bun&apos;s <Mono>--bytecode</Mono> yet,
        which could cut parsing time further.
      </li>
    </List>

    <H2>Reproduce it</H2>
    <TerminalBlock code={BENCH_COMMAND} />
    <P>
      Grab the binary from the{" "}
      <ExternalLink href="https://github.com/davidnussio/envsec/releases/tag/v1.1.0-beta.1">
        v1.1.0-beta.1 release
      </ExternalLink>
      , or install it from the npm and Homebrew beta channels.
    </P>

    <H2>Conclusion</H2>
    <P>
      Effect 4 pulled its weight on its own: a quarter less startup time and
      memory just by upgrading the library. The real leap, though, came from
      three things together: a more compact Effect core, dependencies cut to the
      bone, and a runtime that starts in 4 ms. For a CLI you run all day, going
      from nearly half a second to 32 ms is the difference between a delay you
      notice and one you don&apos;t.
    </P>
  </PostLayout>
);

export default EffectBunPerformancePost;
