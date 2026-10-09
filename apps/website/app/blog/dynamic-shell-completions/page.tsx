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

const SLUG = "dynamic-shell-completions";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const COMPLETE_COMMANDS = `envsec __complete contexts
envsec __complete keys myapp.dev
envsec __complete commands`;

const COMPLETE_OUTPUT = `myapp.dev
myapp.prod
api.key
db.password
stripe.secret
deploy
migrate`;

const HOMEBREW_FORMULA = `def install
  bin.install "envsec"
  generate_completions_from_executable(bin/"envsec", "--completions", shells: [:bash, :zsh, :fish])
end`;

const MANUAL_INSTALL = `# bash 4.4 or newer: add to ~/.bashrc
eval "$(envsec --completions bash)"
# fish: add to ~/.config/fish/config.fish
envsec --completions fish | source
# zsh: write the script into a directory on $fpath
mkdir -p ~/.zfunc
envsec --completions zsh > ~/.zfunc/_envsec`;

const ZSHRC = `# ~/.zshrc, before compinit runs
fpath=(~/.zfunc $fpath)
autoload -Uz compinit && compinit`;

const BASH_PARSE = `_envsec_completions() {
    local i cur prev opts cmd subcmd context_val
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    cmd=""
    subcmd=""
    context_val=""

    # Detect current subcommand and --context value
    for ((i=1; i < COMP_CWORD; i++)); do
        case "\${COMP_WORDS[i]}" in
            -c|--context)
                context_val="\${COMP_WORDS[i+1]}"
                ((i++))
                ;;
            add|get|delete|del|search|list|run|env|env-file|load|rescue|cmd|audit|share|rename|move|copy|secret|shell|tui|doctor)
                if [[ -z "$cmd" ]]; then
                    cmd="\${COMP_WORDS[i]}"
                fi
                ;;
            run|search|list|delete)
                if [[ "$cmd" == "cmd" && -z "$subcmd" ]]; then
                    subcmd="\${COMP_WORDS[i]}"
                fi
                ;;
        esac
    done

    # Also check ENVSEC_CONTEXT env var
    if [[ -z "$context_val" && -n "$ENVSEC_CONTEXT" ]]; then
        context_val="$ENVSEC_CONTEXT"
    fi`;

const BASH_DISPATCH = `    # Complete --context / -c values with dynamic contexts
    if [[ "$prev" == "-c" || "$prev" == "--context" ]]; then
        local contexts
        contexts="$(envsec __complete contexts 2>/dev/null)"
        COMPREPLY=( $(compgen -W "$contexts" -- "$cur") )
        return 0
    fi

    # ...

    case "$cmd" in
        get|delete|del|add|secret)
            # Complete secret keys if context is known
            if [[ -n "$context_val" ]]; then
                local keys
                keys="$(envsec __complete keys "$context_val" 2>/dev/null)"
                COMPREPLY=( $(compgen -W "$keys" -- "$cur") )
            fi
            ;;
    esac
}

complete -F _envsec_completions -o nosort -o bashdefault -o default envsec`;

const COMP_WORDS_DEMO = `# envsec -c myapp.dev get api.k<Tab>
[envsec] [-c] [myapp.dev] [get] [api.k]
# envsec --context=myapp.dev get <Tab>
[envsec] [--context] [=] [myapp.dev] [get] []`;

const ZSH_HELPERS = `#compdef envsec esec

_envsec_contexts() {
    local -a contexts
    contexts=("\${(@f)$(envsec __complete contexts 2>/dev/null)}")
    _describe 'context' contexts
}

_envsec_keys() {
    local ctx="\${opt_args[-c]:-\${opt_args[--context]:-$ENVSEC_CONTEXT}}"
    if [[ -n "$ctx" ]]; then
        local -a keys
        keys=("\${(@f)$(envsec __complete keys "$ctx" 2>/dev/null)}")
        _describe 'key' keys
    fi
}`;

const ZSH_ARGUMENTS = `_envsec() {
    local context curcontext="$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '(-c --context)'{-c,--context}'[Context name]:context:_envsec_contexts' \\
        '(-d --debug)'{-d,--debug}'[Enable debug logging]' \\
        '--json[Output in JSON format]' \\
        '--db[Path to SQLite database]:file:_files' \\
        '--completions[Generate completion script]:shell:(bash zsh fish)' \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--version[Show version]' \\
        '1: :->command' \\
        '*:: :->args' \\
        && return 0

    case $state in
        # ...
        args)
            case $line[1] in
                get)
                    _arguments \\
                        '(-q --quiet)'{-q,--quiet}'[Print only the value]' \\
                        '1:key:_envsec_keys'
                    ;;`;

const ZSH_FIX = `# after the outer _arguments, before "case $state in"
local _envsec_ctx="\${opt_args[-c]:-\${opt_args[--context]}}"

# in _envsec_keys
local ctx="\${_envsec_ctx:-$ENVSEC_CONTEXT}"`;

const FISH_KEYS = `function __envsec_keys
    set -l ctx ""
    set -l args (commandline -opc)
    for i in (seq (count $args))
        if test "$args[$i]" = "-c"; or test "$args[$i]" = "--context"
            set -l next (math $i + 1)
            if test $next -le (count $args)
                set ctx $args[$next]
            end
        end
    end
    if test -z "$ctx"; and test -n "$ENVSEC_CONTEXT"
        set ctx $ENVSEC_CONTEXT
    end
    if test -n "$ctx"
        envsec __complete keys $ctx 2>/dev/null
    end
end

complete -c envsec -l context -s c -x -a '(__envsec_contexts)' -d 'Context name'
complete -c envsec -n '__envsec_using_command get' -x -a '(__envsec_keys)' -d 'Secret key'`;

const FAST_PATH = `const dbPath = resolveDbPath();
const cachePath = path.join(path.dirname(dbPath), "completions.cache");

/** Cache TTL — 60 minutes as safety net. */
const CACHE_TTL_MS = 60 * 60 * 1000;

const tryFastComplete = (): boolean => {
  const args = process.argv.slice(2);
  if (args[0] !== "__complete") {
    return false;
  }
  // ... read and JSON.parse the cache; return false when it is missing,
  // older than CACHE_TTL_MS, or has no keys for the requested context
};

// Fast path — serve from cache without loading any dependencies
if (tryFastComplete()) {
  process.exit(0);
}

// Lazy import the full CLI only when needed
const run = async () => {
  const mod = await import("./cli-runner.js");
  mod.runCli(resolveCustomDbPath(), cachePath);
};`;

const CACHE_JSON = `{
  "commands": ["deploy", "migrate"],
  "contexts": ["myapp.dev", "myapp.prod"],
  "keys": {
    "myapp.dev": ["api.key", "db.password", "stripe.secret"],
    "myapp.prod": ["api.key", "db.password"]
  },
  "updatedAt": 1791548382410
}`;

const LATENCY_COLUMNS = [
  { label: "Command" },
  { highlight: true, label: "Median" },
] as const;

const LATENCY_ROWS = [
  ["envsec __complete keys myapp.dev (cache hit)", "18.3 ms"],
  ["envsec __complete keys myapp.dev (no cache)", "31.6 ms"],
  ["envsec --version (for reference)", "32.3 ms"],
] as const;

const SUPPORT_COLUMNS = [
  { label: "" },
  { label: "bash" },
  { label: "zsh" },
  { label: "fish" },
] as const;

const SUPPORT_ROWS = [
  ["Contexts after -c / --context", "yes", "yes", "yes"],
  ["Contexts after --to (move, copy)", "yes", "yes", "yes"],
  ["Keys from -c on the command line", "yes", "no (bug)", "yes"],
  ["Keys from exported ENVSEC_CONTEXT", "yes", "yes", "yes"],
  ["Keys with --context=value", "no", "no", "no"],
  ["Saved commands for cmd run", "no (bug)", "yes", "yes"],
  ["Saved commands for cmd delete", "no (bug)", "yes", "mixed with keys"],
] as const;

const DynamicShellCompletionsPost = () => (
  <PostLayout
    lead={
      <p>
        A completion script generated at build time knows every subcommand and
        flag of a CLI. It does not know the names you created yesterday. When
        those names are the arguments you type most, a static script completes
        everything except the part you need.
      </p>
    }
    slug={SLUG}
  >
    <P>
      envsec groups secrets into contexts such as <Mono>myapp.dev</Mono>, and
      almost every command takes a context with <Mono>-c</Mono> and a key such
      as <Mono>db.password</Mono>. Contexts, keys and saved command names live
      in a SQLite metadata database on your machine, so the completion script
      has to ask envsec for them on every Tab press. This post walks through how
      that works in bash, zsh and fish, what each shell makes awkward, and the
      bugs I found while testing the scripts for this article.
    </P>

    <H2>One hidden subcommand</H2>
    <P>
      envsec is built on <Mono>effect/cli</Mono>, which can print a static
      completion script for <Mono>--completions &lt;shell&gt;</Mono>. envsec
      intercepts that flag before the CLI parser runs (both{" "}
      <Mono>--completions zsh</Mono> and <Mono>--completions=zsh</Mono>) and
      prints its own scripts instead. <Mono>sh</Mono> is accepted as an alias
      for the bash script.
    </P>
    <P>
      All three scripts call back into the same hidden entry point,{" "}
      <Mono>envsec __complete</Mono>. It takes a type and prints one name per
      line:
    </P>
    <TerminalBlock code={COMPLETE_COMMANDS} />
    <CodeBlock code={COMPLETE_OUTPUT} language="text" />
    <P>
      Plain lines are the lowest common denominator: bash splits them into
      words, zsh splits them on newlines, and fish reads one candidate per line.
      The handler wraps its whole body in <Mono>Effect.ignore</Mono>, because a
      stack trace in the middle of a completion menu is worse than an empty
      menu. The scripts also send stderr to <Mono>/dev/null</Mono>.
    </P>
    <P>
      Completion only ever prints names. The values stay in the OS credential
      store, and listing names reads only the metadata database.
    </P>

    <H2>Installing the scripts</H2>
    <P>
      The Homebrew formula generates all three scripts at install time with
      Homebrew&apos;s <Mono>generate_completions_from_executable</Mono>, which
      runs <Mono>envsec --completions bash</Mono> and friends and drops the
      output where each shell looks for it. On Apple Silicon that is{" "}
      <Mono>/opt/homebrew/etc/bash_completion.d/envsec</Mono>,{" "}
      <Mono>/opt/homebrew/share/zsh/site-functions/_envsec</Mono> and{" "}
      <Mono>/opt/homebrew/share/fish/vendor_completions.d/envsec.fish</Mono>.
    </P>
    <CodeBlock code={HOMEBREW_FORMULA} language="ruby" />
    <P>Without Homebrew, install them by hand:</P>
    <TerminalBlock code={MANUAL_INSTALL} />
    <CodeBlock code={ZSHRC} language="zsh" />
    <P>
      A correction for zsh users: the README and the{" "}
      <Link className={LINK_CLASS} href="/docs">
        docs
      </Link>{" "}
      currently say <Mono>eval &quot;$(envsec --completions zsh)&quot;</Mono>.
      That does not work. The zsh script is written as an autoloadable{" "}
      <Mono>#compdef</Mono> file that ends by calling <Mono>_envsec</Mono>, so
      evaluating it in <Mono>.zshrc</Mono> runs <Mono>_arguments</Mono> outside
      a completion and prints{" "}
      <Mono>
        _arguments:comparguments:327: can only be called from completion
        function
      </Mono>
      . Nothing gets registered. The <Mono>fpath</Mono> setup above is the one
      that works, and it is what Homebrew does for you.
    </P>
    <P>
      The script only contains the static structure; contexts and keys are
      fetched live. Regenerate it after upgrading envsec only if you want new
      subcommands and flags to complete.
    </P>

    <H2>bash: parsing COMP_WORDS by hand</H2>
    <P>
      bash hands the completion function an array of words,{" "}
      <Mono>COMP_WORDS</Mono>, and the index of the word under the cursor,{" "}
      <Mono>COMP_CWORD</Mono>. Everything else is up to you. The envsec script
      walks the words before the cursor once, remembering the first subcommand
      it sees and the word after <Mono>-c</Mono> or <Mono>--context</Mono>:
    </P>
    <CodeBlock code={BASH_PARSE} language="bash" />
    <P>
      Then it decides what to complete. If the previous word is <Mono>-c</Mono>,
      the answer is a context. If the subcommand takes a key and a context is
      known, the answer is a key from that context:
    </P>
    <CodeBlock code={BASH_DISPATCH} language="bash" />
    <P>Three bash quirks shape this script:</P>
    <List>
      <li>
        <Strong>Word breaks.</Strong> bash splits <Mono>COMP_WORDS</Mono> on the
        characters in <Mono>COMP_WORDBREAKS</Mono>, which by default include{" "}
        <Mono>=</Mono> and <Mono>:</Mono> but not <Mono>.</Mono>. Context names
        are validated against <Mono>[a-zA-Z0-9._-]</Mono> and key segments
        against <Mono>[a-zA-Z0-9_-]</Mono> joined by dots, so a name like{" "}
        <Mono>myapp.dev</Mono> stays one word and a colon can never appear. The{" "}
        <Mono>=</Mono> is a different story, shown below.
      </li>
      <li>
        <Strong>Fallback.</Strong> <Mono>-o default</Mono> makes bash fall back
        to file names when the function returns nothing. So{" "}
        <Mono>envsec get &lt;Tab&gt;</Mono> without a known context lists the
        files in the current directory. It&apos;s harmless, but it can look like
        a bug.
      </li>
      <li>
        <Strong>bash version.</Strong> <Mono>-o nosort</Mono> needs bash 4.4 or
        newer. The <Mono>/bin/bash</Mono> that ships with macOS is 3.2, rejects
        the option and leaves envsec with no completion at all. Use a current
        bash from Homebrew.
      </li>
    </List>
    <P>
      Here is what <Mono>COMP_WORDS</Mono> looks like with the two ways of
      passing a context, captured with a debug completion function:
    </P>
    <CodeBlock code={COMP_WORDS_DEMO} language="text" />
    <P>
      With <Mono>--context=myapp.dev</Mono> the loop reads <Mono>=</Mono> as the
      context, asks for the keys of a context called <Mono>=</Mono>, gets
      nothing back and falls through to file names. Only the space-separated
      form completes keys.
    </P>
    <P>
      The same loop hides a real bug. <Mono>run</Mono>, <Mono>list</Mono>,{" "}
      <Mono>search</Mono> and <Mono>delete</Mono> are top-level subcommands too,
      so they match the first <Mono>case</Mono> pattern, and bash runs only the
      first matching branch. <Mono>subcmd</Mono> is never set, and{" "}
      <Mono>envsec cmd run &lt;Tab&gt;</Mono> offers{" "}
      <Mono>run search list delete</Mono> again instead of your saved commands.
      I found this while writing the post; it&apos;s on the fix list.
    </P>

    <H2>zsh: _arguments, _describe and a lost flag</H2>
    <P>
      zsh does the parsing for you. <Mono>_arguments</Mono> takes a spec for
      every option and positional argument, and a spec can name a function that
      produces candidates. <Mono>_describe</Mono> then adds them with grouping
      and descriptions. The helpers read the output of <Mono>__complete</Mono>{" "}
      with the <Mono>(@f)</Mono> flag, which splits on newlines:
    </P>
    <CodeBlock code={ZSH_HELPERS} language="zsh" />
    <P>
      <Mono>_describe</Mono> treats a colon as the separator between a candidate
      and its description, so a colon in a name would need escaping. The same
      validation rules that help bash mean it never comes up.
    </P>
    <P>
      The main function uses the state machine of <Mono>_arguments -C</Mono>:
      global options first, then the subcommand, then a nested{" "}
      <Mono>_arguments</Mono> call per subcommand:
    </P>
    <CodeBlock code={ZSH_ARGUMENTS} language="zsh" />
    <P>
      <Mono>_envsec_keys</Mono> looks for the context in <Mono>opt_args</Mono>,
      the associative array where <Mono>_arguments</Mono> stores the options it
      has parsed. The catch is that the nested <Mono>_arguments</Mono> call for{" "}
      <Mono>get</Mono> repopulates <Mono>opt_args</Mono> with its own options,
      and <Mono>-c</Mono> belongs to the outer call. By the time{" "}
      <Mono>_envsec_keys</Mono> runs, the flag is gone. In my tests{" "}
      <Mono>envsec -c myapp.dev get &lt;Tab&gt;</Mono> never called{" "}
      <Mono>envsec</Mono> at all, and with <Mono>ENVSEC_CONTEXT=myapp.dev</Mono>{" "}
      exported, <Mono>envsec -c myapp.prod get &lt;Tab&gt;</Mono> offered the
      keys of <Mono>myapp.dev</Mono>. That second case is worse than no
      completion.
    </P>
    <P>
      The fix is two lines: copy the context out of <Mono>opt_args</Mono> before
      the nested call and read the copy, which works because zsh functions see
      the locals of their callers. I tested it on a copy of the script and it
      completes the right keys:
    </P>
    <CodeBlock code={ZSH_FIX} language="zsh" />
    <P>
      Until that ships, key completion in zsh works only with an exported{" "}
      <Mono>ENVSEC_CONTEXT</Mono>.
    </P>

    <H2>fish: complete -a with a command substitution</H2>
    <P>
      fish has the most declarative model. Each <Mono>complete</Mono> line says
      which command it applies to, an optional condition (<Mono>-n</Mono>
      ), and the candidates (<Mono>-a</Mono>). When the candidates are written
      as <Mono>&apos;(…)&apos;</Mono>, fish runs the substitution at Tab time.
      The conditions are fish functions, so checking them doesn&apos;t start
      envsec; only the substitution does. <Mono>commandline -opc</Mono> returns
      the tokens before the cursor, already split the way fish would split them:
    </P>
    <CodeBlock code={FISH_KEYS} language="fish" />
    <P>
      <Mono>-x</Mono> (short for <Mono>-r -f</Mono>) turns off file-name
      completion for that argument, and <Mono>-d</Mono> adds the grey
      description fish shows next to each candidate. In my tests fish handled
      the most cases correctly. It shares the <Mono>--context=value</Mono> blind
      spot, since the loop compares whole tokens. It also has its own small bug:{" "}
      <Mono>envsec cmd delete &lt;Tab&gt;</Mono> mixes secret keys into the
      saved command names, because the condition for the top-level{" "}
      <Mono>delete</Mono> command also matches when <Mono>delete</Mono> comes
      after <Mono>cmd</Mono>.
    </P>

    <H2>The latency budget</H2>
    <P>
      Every dynamic completion starts a new envsec process. In my tests bash and
      zsh started one per Tab press, and fish started one per completion and
      then paged through the results without calling again. Whatever envsec
      spends on startup, you wait for before the menu appears.
    </P>
    <P>
      This is where the startup work behind the Bun binary pays off (
      <Link className={LINK_CLASS} href="/blog/effect-4-bun-performance">
        From 417 to 32 milliseconds
      </Link>
      ). As measured there, an empty Node process takes about 76 ms to start and
      an empty Bun process about 4.5 ms, before envsec runs a line of its own
      code. The completion path goes one step further. Before it imports
      anything else, <Mono>main.ts</Mono> checks whether it was called as{" "}
      <Mono>__complete</Mono> and tries to answer from a JSON cache:
    </P>
    <CodeBlock code={FAST_PATH} language="ts" />
    <P>
      The cache sits next to the database (
      <Mono>~/.envsec/completions.cache</Mono> by default, or next to{" "}
      <Mono>ENVSEC_DB</Mono>), is created with mode <Mono>0600</Mono>, and holds
      names only. This one is pretty-printed; the real file is a single line:
    </P>
    <CodeBlock code={CACHE_JSON} language="json" />
    <P>
      It is rebuilt after every command that can change names (<Mono>add</Mono>,{" "}
      <Mono>delete</Mono>, <Mono>load</Mono>, <Mono>rescue</Mono>,{" "}
      <Mono>cmd</Mono>, <Mono>rename</Mono>, <Mono>move</Mono>,{" "}
      <Mono>copy</Mono>, <Mono>secret</Mono>), and after any completion that
      misses it. Here is what the two paths cost:
    </P>
    <DataTable
      caption="Median of 40 runs (hyperfine -N, 5 warm-ups; the no-cache run deletes the cache before each run). Homebrew binary envsec 1.1.2 on an Apple M4 Pro, sandbox database with 2 contexts and 5 keys."
      columns={LATENCY_COLUMNS}
      rows={LATENCY_ROWS}
    />
    <P>
      The cache saves about 13 ms per Tab. A miss costs about as much as any
      other envsec command, because the slow path loads the full CLI and SQLite.
      It also lists every context to rebuild the cache, so its cost grows with
      the number of contexts.
    </P>
    <H3>Trade-offs</H3>
    <List>
      <li>
        <Strong>Staleness.</Strong> Only CLI commands refresh the cache. Secrets
        added from <Mono>envsec tui</Mono> or the SDK in an existing context may
        not show up in completions until the 60-minute TTL expires or you run a
        CLI command that refreshes it.
      </li>
      <li>
        <Strong>--db is not forwarded.</Strong> The scripts call{" "}
        <Mono>envsec __complete</Mono> without your <Mono>--db</Mono> flag. An
        exported <Mono>ENVSEC_DB</Mono> works, because the child process
        inherits it.
      </li>
      <li>
        <Strong>A file on disk.</Strong> The cache duplicates names that are
        already in <Mono>store.sqlite</Mono>. If key names are sensitive to you,
        they were already on disk.
      </li>
    </List>

    <H2>What works today</H2>
    <P>
      I tested each case in bash 5.3, zsh 5.9 and fish 4.9 inside a sandbox,
      logging every call to <Mono>envsec</Mono>:
    </P>
    <DataTable columns={SUPPORT_COLUMNS} rows={SUPPORT_ROWS} />
    <P>
      All three scripts also register completions for <Mono>esec</Mono>, a name
      envsec doesn&apos;t install, so that only helps if you define it yourself.
    </P>

    <H2>In short</H2>
    <List>
      <li>
        One hidden subcommand, <Mono>envsec __complete</Mono>, prints names one
        per line. The shell scripts decide when to call it.
      </li>
      <li>
        Each shell has its own parsing model: hand-rolled for bash,{" "}
        <Mono>_arguments</Mono> for zsh, declarative <Mono>complete</Mono> lines
        for fish. Each one had at least one bug I only found by driving a real
        shell.
      </li>
      <li>
        A Tab press costs a process start. A JSON cache read before any other
        import keeps a cache hit at about 18 ms on my machine.
      </li>
    </List>
    <P>
      The full scripts are in{" "}
      <ExternalLink href="https://github.com/davidnussio/envsec/tree/main/packages/cli/src/completions">
        packages/cli/src/completions
      </ExternalLink>
      , and the zsh <Mono>_arguments</Mono> reference is in the{" "}
      <ExternalLink href="https://zsh.sourceforge.io/Doc/Release/Completion-System.html">
        zsh completion system manual
      </ExternalLink>
      .
    </P>
  </PostLayout>
);

export default DynamicShellCompletionsPost;
