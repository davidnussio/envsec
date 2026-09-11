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

const SLUG = "building-a-cli-with-effect-4";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const ADD_COMMAND = `import { Argument as Args, Command, Flag as Options } from "effect/cli";

const keyArg = Args.String("key");
const valueOption = Options.String("value").pipe(
  Options.withAlias("v"),
  Options.withDescription("Value to store (omit for interactive prompt)"),
  Options.optional
);
const expiresOption = Options.String("expires").pipe(
  Options.withAlias("e"),
  Options.withDescription("Expiry duration (e.g. 30m, 2h, 7d, 4w, 3mo, 1y)"),
  Options.optional
);

export const addCommand = Command.make(
  "add",
  { key: keyArg, value: valueOption, expires: expiresOption },
  ({ key, value, expires }) =>
    Effect.gen(function* addHandler() {
      const ctx = yield* requireContext;
      const secret = Option.isSome(value)
        ? value.value
        : yield* readSecret(\`\${icons.key} Enter secret value: \`);
      // …validate, parse --expires, then:
      yield* SecretStore.set(ctx, key, secret, expiresAt);
    })
).pipe(Command.withDescription("Store a secret in a context"));`;

const ROOT_COMMAND = `export const rootCommand = Command.make("envsec").pipe(
  Command.withDescription(
    "Secure environment secrets management using native OS credential stores"
  ),
  Command.withSharedFlags({
    context: contextFlag,
    debug: debugFlag,
    json: jsonFlag,
    db: dbFlag,
  })
);

/** Inside any subcommand handler: */
export const isJsonOutput = Effect.gen(function* isJsonOutput() {
  const { json } = yield* rootCommand;
  return json;
});`;

const REQUIRE_CONTEXT = `const decodeContext = Schema.decodeEffect(ContextName);

export const requireContext = Effect.gen(function* requireContext() {
  const context = yield* rawContext; // --context, then ENVSEC_CONTEXT
  if (Option.isNone(context)) {
    return yield* Effect.fail(
      new Error(
        "Missing required option --context (-c) or ENVSEC_CONTEXT env var"
      )
    );
  }
  return yield* decodeContext(context.value);
});`;

const SUBCOMMANDS = `const command = rootCommand.pipe(
  Command.withSubcommands([
    addCommand,
    getCommand,
    deleteCommand,
    // …17 more
  ]),
  // --debug is a shortcut for --log-level debug.
  Command.provide(({ debug }) =>
    debug ? Layer.succeed(References.MinimumLogLevel, "Debug") : Layer.empty
  )
);

// Nested groups work the same way: \`envsec cmd run|search|list|delete\`
export const cmdCommand = Command.make("cmd", {}).pipe(
  Command.withDescription("Manage saved commands"),
  Command.withSubcommands([cmdRunCommand, cmdSearchCommandDef, /* … */])
);`;

const KEYCHAIN_SERVICE = `export class KeychainAccess extends Context.Service<
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

const SECRET_STORE = `export class SecretStore extends Context.Service<SecretStore>()(
  "envsec/SecretStore",
  {
    make: Effect.gen(function* make() {
      const keychain = yield* KeychainAccess;
      const metadata = yield* MetadataStore;
      // …set, get, remove, list, audit queries
      return { set, get, remove /* … */ };
    }),
  }
) {
  static readonly layerNoDeps = Layer.effect(this, this.make);

  static readonly layer = (
    databaseConfig: Layer.Layer<DatabaseConfig> = DatabaseConfigDefault
  ) =>
    this.layerNoDeps.pipe(
      Layer.provide(
        Layer.merge(
          PlatformKeychainAccessLive,
          SqliteMetadataStoreLive.pipe(Layer.provide(databaseConfig))
        )
      )
    );

  static readonly set = (
    context: string,
    key: string,
    value: string,
    expiresAt?: string | null
  ) => this.use((store) => store.set(context, key, value, expiresAt));
}`;

const ERRORS = `export class InvalidDurationError extends Schema.TaggedError<InvalidDurationError>()(
  "InvalidDurationError",
  { input: Schema.String, message: Schema.String }
) {}

export class CommandExecutionError extends Schema.TaggedError<CommandExecutionError>()(
  "CommandExecutionError",
  {
    command: Schema.String,
    exitCode: Schema.Number,
    message: Schema.String,
    signal: Schema.optional(Schema.String),
  }
) {
  /** Propagate the child process exit code as the CLI's own exit code. */
  override get [Runtime.errorExitCode](): number {
    return this.exitCode;
  }

  /** Ctrl-C is the user stopping the command on purpose: exit quietly. */
  override get [Runtime.errorReported](): boolean {
    return this.signal !== "SIGINT";
  }
}`;

const DEFAULT_ERROR_OUTPUT = `# A toy CLI with the default runMain error handling
bun main.ts get nope
[14:19:53.990] ERROR (#1): NotFoundError: No secret "nope"
    at get (…/vault.ts:24:27)
    at runLoop (…/effect/dist/internal/effect.js:463:86)
    …`;

const ENVSEC_ERROR_OUTPUT = `envsec -c myapp.dev get nope
✖ Secret metadata not found: myapp.dev/nope

envsec -c myapp.dev run "exit 3"
✖ Command exited with code 3
echo $?
3`;

const REPORT_ERRORS = `export const reportErrors = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, unknown, R> =>
  effect.pipe(
    Effect.catchCause((cause): Effect.Effect<never, unknown> => {
      if (Cause.hasInterruptsOnly(cause)) {
        return Effect.failCause(cause);
      }
      const squashed = Cause.squash(cause);
      if (!Runtime.getErrorReported(squashed)) {
        return Effect.failCause(cause); // already rendered by effect/cli
      }
      const failure = Cause.findErrorOption(cause);
      const output = Option.isSome(failure)
        ? \`\${icons.error} \${messageOf(failure.value)}\`
        : \`\${icons.error} Unexpected error:\\n\${Cause.pretty(cause)}\`;
      return Console.error(output).pipe(
        Effect.andThen(
          Effect.fail(
            new ReportedFailureError(Runtime.getErrorExitCode(squashed))
          )
        )
      );
    })
  );`;

const RUNNER = `const cli = Command.runWith(command, {
  version: envsecVersion,
})(process.argv.slice(2));

export const runCliWithLayer = (
  cachePath: string,
  secretStoreLayer: Layer.Layer<SecretStore, unknown>
): void => {
  // …completion interception elided
  cli.pipe(
    Effect.provide(secretStoreLayer),
    Effect.provide(nodeServicesLayer),
    // Logs are diagnostics: keep them off stdout, which carries data.
    Effect.provideService(References.LogToStderr, true),
    reportErrors,
    runMain
  );
};`;

const NODE_SERVICES = `import { layer as childProcessSpawnerLayer } from "@effect/platform-node-shared/NodeChildProcessSpawner";
import { layer as cryptoLayer } from "@effect/platform-node-shared/NodeCrypto";
import { layer as fileSystemLayer } from "@effect/platform-node-shared/NodeFileSystem";
import { layer as pathLayer } from "@effect/platform-node-shared/NodePath";
import { layer as stdioLayer } from "@effect/platform-node-shared/NodeStdio";
import { layer as terminalLayer } from "@effect/platform-node-shared/NodeTerminal";

export { runMain } from "@effect/platform-node-shared/NodeRuntime";

/** Equivalent to \`NodeServices.layer\` from @effect/platform-node. */
export const nodeServicesLayer = Layer.provideMerge(
  childProcessSpawnerLayer,
  Layer.mergeAll(fileSystemLayer, cryptoLayer, pathLayer, stdioLayer, terminalLayer)
);`;

const MEMORY_KEYCHAIN = `const memoryKeychain = (entries = new Map()) =>
  Layer.succeed(KeychainAccess, {
    get: (service, account) => {
      const value = entries.get(\`\${service}/\${account}\`);
      return value === undefined
        ? Effect.fail(new SecretNotFoundError({ /* … */ }))
        : Effect.succeed(value);
    },
    remove: (service, account) =>
      Effect.sync(() => { entries.delete(\`\${service}/\${account}\`); }),
    set: (service, account, password) =>
      Effect.sync(() => { entries.set(\`\${service}/\${account}\`, password); }),
  });

const storeLayer = (databasePath, keychain = memoryKeychain()) =>
  SecretStore.layerNoDeps.pipe(
    Layer.provide(
      Layer.merge(
        keychain,
        SqliteMetadataStoreLive.pipe(
          Layer.provide(DatabaseConfigFrom(databasePath))
        )
      )
    )
  );`;

const RUN_WITH_TEST = `import { expect, test } from "bun:test";
import { Effect, FileSystem, Layer, Path, Stdio, Terminal } from "effect";
import { Command } from "effect/cli";
import { ChildProcessSpawner } from "effect/process";

const CliTestLayer = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(Terminal.Terminal, Terminal.make({
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    readInput: Effect.die("unused"),
    readLine: Effect.die("unused"),
    display: () => Effect.void,
  })),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("unused"))
  )
);

test("add stores the value", async () => {
  const entries = new Map<string, string>();
  const run = Command.runWith(vault, { version: "0.1.0" });
  await Effect.runPromise(
    run(["add", "api.key", "--value", "s3cret"]).pipe(
      Effect.provide(memoryKeyStore(entries)),
      Effect.provide(CliTestLayer)
    )
  );
  expect(entries.get("api.key")).toBe("s3cret");
});`;

const EffectCliPost = () => (
  <PostLayout
    lead={
      <p>
        A command-line tool looks small from the outside: parse some flags, call
        something, print a line. Then you add subcommands, a flag that every
        command shares, errors that must go to stderr with the right exit code,
        a dependency on the operating system that you cannot run in CI, and
        tests. That plumbing is most of the code.
      </p>
    }
    slug={SLUG}
  >
    <P>
      envsec is a CLI that stores secrets in the OS credential store and their
      metadata in SQLite. It has 20 top-level commands and is built on Effect 4,
      whose CLI module now ships inside the <Mono>effect</Mono> package as{" "}
      <Mono>effect/cli</Mono>. This is a tour of how the pieces fit, with
      trimmed excerpts from the real code. Every API shown is from Effect 4.0.0,
      the version envsec depends on; Effect 3&apos;s <Mono>@effect/cli</Mono>{" "}
      looked different in several places.
    </P>
    <P>
      For the startup-time side of the same migration, see{" "}
      <Link className={LINK_CLASS} href="/blog/effect-4-bun-performance">
        From 417 to 32 milliseconds
      </Link>
      .
    </P>

    <H2>The shape of the program</H2>
    <P>Three files do the wiring:</P>
    <OrderedList>
      <li>
        <Mono>main.ts</Mono> handles the tab-completion fast path without
        loading Effect at all, then lazily imports the real CLI.
      </li>
      <li>
        <Mono>cli-runner.ts</Mono> assembles the command tree, provides the
        layers and runs the program.
      </li>
      <li>
        <Mono>cli/root.ts</Mono> defines the root command and its shared flags;
        most other files in <Mono>cli/</Mono> define one subcommand each.
      </li>
    </OrderedList>
    <P>
      The domain code (services, errors, the SQLite store and the three keychain
      adapters) lives in a separate <Mono>@envsec/core</Mono> package, which the
      SDK and the TUI also use.
    </P>

    <H2>A command with flags and arguments</H2>
    <P>
      In Effect 4, flags come from the <Mono>Flag</Mono> module and positional
      arguments from <Mono>Argument</Mono>. envsec imports them as{" "}
      <Mono>Options</Mono> and <Mono>Args</Mono>, the module names from{" "}
      <Mono>@effect/cli</Mono>, which kept the migration diff small. Here is{" "}
      <Mono>add</Mono>, trimmed:
    </P>
    <CodeBlock code={ADD_COMMAND} language="ts" />
    <P>A few things worth noticing:</P>
    <List>
      <li>
        <Mono>Command.make(name, config, handler)</Mono> infers the handler
        input from the config object. <Mono>key</Mono> is a <Mono>string</Mono>,
        and the two optional flags arrive as <Mono>Option&lt;string&gt;</Mono>.
      </li>
      <li>
        The key order of the config object sets the order in <Mono>--help</Mono>
        . envsec&apos;s linter wants sorted keys, so these objects carry an{" "}
        <Mono>oxlint-disable</Mono> comment.
      </li>
      <li>
        <Mono>withDefault</Mono> turns an optional flag into a plain value;{" "}
        <Mono>optional</Mono> keeps it as an <Mono>Option</Mono>. Every boolean
        flag in envsec has a default, so handlers never see an{" "}
        <Mono>Option&lt;boolean&gt;</Mono>.
      </li>
      <li>
        Help comes for free. <Mono>envsec add --help</Mono> prints the
        description, usage, arguments and flags from these definitions.
      </li>
    </List>

    <H2>Shared flags and reading the parent</H2>
    <P>
      <Mono>--context</Mono>, <Mono>--debug</Mono>, <Mono>--json</Mono> and{" "}
      <Mono>--db</Mono> apply to every command. They are declared once on the
      root with <Mono>Command.withSharedFlags</Mono>, and a subcommand reads
      them by yielding the parent command inside its handler:
    </P>
    <CodeBlock code={ROOT_COMMAND} language="ts" />
    <P>
      Shared flags are accepted before or after the subcommand, so{" "}
      <Mono>envsec -c myapp.dev list</Mono> and{" "}
      <Mono>envsec list -c myapp.dev</Mono> both work. The smoke tests check
      this, along with a subtler case: <Mono>add -v</Mono> means{" "}
      <Mono>--value</Mono>, not the global <Mono>--version</Mono>.
    </P>
    <P>
      The context is then validated with a branded Schema, so a bad name fails
      before any keychain call:
    </P>
    <CodeBlock code={REQUIRE_CONTEXT} language="ts" />
    <P>
      <Mono>Flag.withFallbackConfig</Mono> could read{" "}
      <Mono>ENVSEC_CONTEXT</Mono> automatically. I apply it by hand instead,
      because <Mono>cmd run</Mono> needs to tell an explicit{" "}
      <Mono>--context</Mono> apart from one inherited from the environment.
    </P>

    <H2>Subcommands</H2>
    <P>
      The tree is assembled in one place with{" "}
      <Mono>Command.withSubcommands</Mono>. Groups nest: <Mono>cmd</Mono> is a
      command with no handler of its own and four children. Aliases are one
      call: <Mono>delete</Mono> uses{" "}
      <Mono>Command.withAlias(&quot;del&quot;)</Mono>.
    </P>
    <CodeBlock code={SUBCOMMANDS} language="ts" />
    <P>
      <Mono>Command.provide</Mono> accepts either a layer or a function from the
      parsed input to a layer. envsec uses the second form to turn{" "}
      <Mono>--debug</Mono> into a minimum log level for the whole run.
    </P>

    <H2>Services and layers</H2>
    <P>
      Commands never call <Mono>security</Mono>, <Mono>secret-tool</Mono> or
      SQLite directly. They talk to a <Mono>SecretStore</Mono> service, which
      depends on two narrower services: <Mono>KeychainAccess</Mono> for values
      and <Mono>MetadataStore</Mono> for everything else. In Effect 4, a service
      is a class that extends <Mono>Context.Service</Mono>:
    </P>
    <CodeBlock code={KEYCHAIN_SERVICE} language="ts" />
    <P>
      There are three implementations of this interface, one per OS, and{" "}
      <Mono>PlatformKeychainAccessLive</Mono> picks one with a{" "}
      <Mono>switch</Mono> on <Mono>os.platform()</Mono>. On any other platform
      it is a layer that fails with <Mono>UnsupportedPlatformError</Mono>. The
      adapters themselves are the subject of{" "}
      <Link className={LINK_CLASS} href="/blog/one-cli-three-keychains">
        One CLI, three keychains
      </Link>
      .
    </P>
    <P>
      <Mono>SecretStore</Mono> uses the other form of{" "}
      <Mono>Context.Service</Mono>, with a <Mono>make</Mono> effect, and exposes
      two layers: one without dependencies and one with the production ones
      wired in.
    </P>
    <CodeBlock code={SECRET_STORE} language="ts" />
    <P>
      The static helpers built on <Mono>this.use</Mono> let a handler write{" "}
      <Mono>yield* SecretStore.set(…)</Mono> instead of first yielding the
      service. The SQLite layer opens the database with{" "}
      <Mono>Effect.acquireRelease</Mono>, so it is closed when the program ends,
      even on failure.
    </P>
    <P>
      One wrinkle: <Mono>--db</Mono> chooses the database file, but the layer
      that needs it is built before the CLI parses anything. So{" "}
      <Mono>db-path.ts</Mono> reads <Mono>--db</Mono> and <Mono>ENVSEC_DB</Mono>{" "}
      straight from <Mono>process.argv</Mono> and the environment, and passes
      the result to <Mono>SecretStore.layer(DatabaseConfigFrom(path))</Mono>.
      The flag is still declared on the root so it shows up in{" "}
      <Mono>--help</Mono>.
    </P>

    <H2>Typed errors</H2>
    <P>
      Every domain error is a <Mono>Schema.TaggedError</Mono>, all in one module
      of <Mono>@envsec/core</Mono>. They show up in the error channel of each
      effect&apos;s type, and handlers recover from specific ones with{" "}
      <Mono>Effect.catchTag</Mono>. <Mono>get</Mono>, for example, catches{" "}
      <Mono>SecretNotFoundError</Mono> to print a cleanup hint when the metadata
      exists but the keychain entry is gone.
    </P>
    <CodeBlock code={ERRORS} language="ts" />
    <P>
      The second class shows two Effect 4 hooks that matter for a CLI.{" "}
      <Mono>Runtime.errorExitCode</Mono> sets the process exit code when the
      error reaches the top, so <Mono>envsec run</Mono> exits with the code of
      the command it ran. <Mono>Runtime.errorReported</Mono> controls whether
      the runtime logs the error at all; Ctrl-C on a child process should not
      print anything.
    </P>

    <H3>Reporting errors to a human</H3>
    <P>
      <Mono>runMain</Mono> logs any reported failure through the default logger:
      a timestamp, the fiber id, the error and a stack trace, all on stdout.
      That is useful for a server and wrong for a CLI whose stdout is often
      piped into <Mono>eval</Mono> or another program. This is what it looks
      like on a small test CLI:
    </P>
    <TerminalBlock code={DEFAULT_ERROR_OUTPUT} />
    <P>
      envsec wraps the whole program in <Mono>reportErrors</Mono>. It prints the
      error message as one line on stderr, then fails with a marker error whose{" "}
      <Mono>errorReported</Mono> is <Mono>false</Mono>, so <Mono>runMain</Mono>{" "}
      only applies the exit code. Parse errors that <Mono>effect/cli</Mono> has
      already rendered with the help text pass through untouched. Unexpected
      defects get the full cause.
    </P>
    <CodeBlock code={REPORT_ERRORS} language="ts" />
    <TerminalBlock code={ENVSEC_ERROR_OUTPUT} />

    <H2>Running it</H2>
    <P>
      <Mono>Command.runWith</Mono> takes the command and a version string and
      returns a function from an argument array to an effect.{" "}
      <Mono>Command.run</Mono> does the same but reads the arguments from the{" "}
      <Mono>Stdio</Mono> service. The rest is providing layers and handing the
      effect to <Mono>runMain</Mono>:
    </P>
    <CodeBlock code={RUNNER} language="ts" />
    <P>
      The platform layer is the Node implementation of the services{" "}
      <Mono>effect/cli</Mono> needs: file system, path, stdio, terminal and
      child processes. Effect&apos;s own examples use{" "}
      <Mono>NodeServices.layer</Mono> from <Mono>@effect/platform-node</Mono>.
      envsec builds the same layer from deep imports of{" "}
      <Mono>@effect/platform-node-shared</Mono>, because that package barrel
      also loads modules a CLI never uses:
    </P>
    <CodeBlock code={NODE_SERVICES} language="ts" />
    <P>
      The same code runs on Node from npm and as a standalone Bun binary.
      Nothing in it is Bun-specific.
    </P>

    <H2>Testing</H2>
    <P>
      The service boundary is what makes envsec testable. A test never touches
      the real keychain: it provides <Mono>SecretStore.layerNoDeps</Mono> with
      an in-memory <Mono>KeychainAccess</Mono> and a temporary SQLite file. This
      is from <Mono>packages/core/test/secret-store.test.mjs</Mono>:
    </P>
    <CodeBlock code={MEMORY_KEYCHAIN} language="js" />
    <P>
      It is also why <Mono>runCliWithLayer</Mono> takes the{" "}
      <Mono>SecretStore</Mono> layer as a parameter. The end-to-end script runs
      the full CLI through a small entry point, <Mono>test/e2e-main.mjs</Mono>,
      that passes in a layer backed by a JSON file instead of the OS keychain.
      That covers add, get, list, search, env-file, load, delete, run and cmd on
      any machine, without leaving entries in a real keychain.
    </P>
    <P>
      The CLI smoke tests take the outside view: they spawn the built{" "}
      <Mono>dist/main.js</Mono> with a temporary <Mono>--db</Mono> and assert on
      stdout, stderr and the exit status. One of them checks that an invalid
      context leaves stdout empty and exits with 1.
    </P>
    <P>
      envsec&apos;s tests use <Mono>node:test</Mono> against the compiled
      output. If you want to test a command in-process instead,{" "}
      <Mono>Command.runWith</Mono> takes the arguments directly, and the
      platform services can be replaced with test layers. This minimal example
      runs with <Mono>bun test</Mono> on Effect 4.0.0; <Mono>vault</Mono> is a
      two-command toy CLI with the same structure as envsec, and{" "}
      <Mono>memoryKeyStore</Mono> its in-memory service:
    </P>
    <CodeBlock code={RUN_WITH_TEST} language="ts" />

    <H2>Trade-offs</H2>
    <List>
      <li>
        <Strong>The CLI module is marked unstable.</Strong> The Effect 4 source
        tags these functions <Mono>@stability unstable</Mono>, so I pin the
        exact version: envsec depends on <Mono>effect</Mono> <Mono>4.0.0</Mono>,
        not a range.
      </li>
      <li>
        <Strong>Loading code is not free.</Strong> On my machine, loading and
        initialising envsec&apos;s modules took about 116 ms on Node and 28 ms
        in the Bun binary. That is why tab completion in envsec reads a JSON
        cache in <Mono>main.ts</Mono> and only imports the CLI on a cache miss.
      </li>
      <li>
        <Strong>Some things still live outside the parser.</Strong>{" "}
        <Mono>--db</Mono> is read from <Mono>argv</Mono> before parsing, and{" "}
        <Mono>--completions</Mono> is intercepted so envsec can print its own
        dynamic scripts instead of the static ones <Mono>effect/cli</Mono>{" "}
        generates.
      </li>
    </List>

    <H2>In short</H2>
    <P>
      <Mono>Command.make</Mono> plus <Mono>Flag</Mono> and <Mono>Argument</Mono>{" "}
      give you typed input and generated help. <Mono>withSharedFlags</Mono> and
      yielding the parent command handle global options.{" "}
      <Mono>Context.Service</Mono> and layers keep the OS out of your handlers,
      which is what makes the CLI testable. <Mono>Schema.TaggedError</Mono> with
      the <Mono>Runtime</Mono> markers gives you exit codes, and a small wrapper
      around <Mono>runMain</Mono> keeps errors on stderr. The full source is on{" "}
      <ExternalLink href="https://github.com/davidnussio/envsec/tree/main/packages/cli/src">
        GitHub
      </ExternalLink>
      , and Effect&apos;s own{" "}
      <ExternalLink href="https://github.com/Effect-TS/effect/blob/main/ai-docs/src/70_cli/10_basics.ts">
        CLI example
      </ExternalLink>{" "}
      is a good first read.
    </P>
  </PostLayout>
);

export default EffectCliPost;
