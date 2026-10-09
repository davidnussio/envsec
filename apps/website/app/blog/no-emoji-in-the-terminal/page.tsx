import Link from "next/link";

import { PostLayout, postMetadata } from "@/components/blog/post-layout";
import {
  DataTable,
  ExternalLink,
  H2,
  List,
  Mono,
  P,
  Strong,
} from "@/components/blog/prose";
import { CodeBlock } from "@/components/code-block";

const SLUG = "no-emoji-in-the-terminal";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const WIDTH_COLUMNS = [
  { label: "Sequence" },
  { label: "Code points" },
  { label: "East_Asian_Width" },
  { highlight: true, label: "wcswidth" },
] as const;

const WIDTH_ROWS = [
  ["🔑 old key icon", "U+1F511", "W", "2"],
  ["🛡 old shield icon", "U+1F6E1", "N", "1"],
  ["🛡️ shield + VS16", "U+1F6E1 U+FE0F", "N (base)", "1"],
  ["⚠️ warning + VS16", "U+26A0 U+FE0F", "N (base)", "1"],
  ["👩‍💻 ZWJ sequence", "U+1F469 U+200D U+1F4BB", "W (base)", "4"],
  ["◆ current key icon", "U+25C6", "A", "1"],
] as const;

const DIFF = `-  key: yellow("🔑"), // U+1F511
-  lock: green("🔒"), // U+1F512
-  folder: blue("📁"), // U+1F4C1
-  shield: green("🛡"), // U+1F6E1
-  check: green("✅"), // U+2705
-  broom: yellow("🧹"), // U+1F9F9
+  key: yellow("◆"), // U+25C6
+  lock: green("■"), // U+25A0
+  folder: blue("▸"), // U+25B8
+  shield: green("◈"), // U+25C8
+  check: green("✔"), // U+2714
+  broom: yellow("~"), // tilde`;

const ICON_COLUMNS = [
  { label: "Icon" },
  { label: "Glyph" },
  { label: "Code point" },
  { label: "Colour" },
  { label: "EAW" },
  { label: "Meaning" },
] as const;

const ICON_ROWS = [
  ["arrow", "→", "U+2192", "dim", "A", "from → to"],
  ["bolt", "›", "U+203A", "yellow", "N", "saved command"],
  ["broom", "~", "U+007E", "yellow", "Na", "stale records removed"],
  ["cancel", "⊘", "U+2298", "dim", "N", "cancelled"],
  ["chart", "▪", "U+25AA", "blue", "N", "summary line"],
  ["check", "✔", "U+2714", "green", "N", "all clear"],
  ["clock", "◔", "U+25D4", "yellow", "N", "expires soon"],
  ["dice", "⬡", "U+2B21", "magenta", "N", "generated secret"],
  ["download", "↓", "U+2193", "cyan", "A", "TUI only"],
  ["empty", "∅", "U+2205", "dim", "N", "nothing found"],
  ["env", "$", "U+0024", "cyan", "Na", "not used yet"],
  ["error", "✖", "U+2716", "red", "N", "error"],
  ["expired", "✖", "U+2716", "red", "N", "expired"],
  ["file", "·", "U+00B7", "cyan", "A", ".env file"],
  ["folder", "▸", "U+25B8", "blue", "N", "context"],
  ["info", "●", "U+25CF", "blue", "A", "information"],
  ["key", "◆", "U+25C6", "yellow", "A", "secret key"],
  ["lock", "■", "U+25A0", "green", "A", "resolved, secured"],
  ["save", "↓", "U+2193", "green", "A", "command saved"],
  ["search", "◎", "U+25CE", "blue", "A", "search"],
  ["shell", "▶", "U+25B6", "green", "A", "subshell, next step"],
  ["shield", "◈", "U+25C8", "green", "A", "doctor, encryption"],
  ["success", "✔", "U+2714", "green", "N", "done"],
  ["trash", "×", "U+00D7", "red", "A", "removed"],
  ["unlock", "□", "U+25A1", "red", "A", "not used yet"],
  ["upload", "↑", "U+2191", "magenta", "A", "TUI only"],
  ["warning", "▲", "U+25B2", "yellow", "A", "warning, confirm"],
] as const;

const COLOR_CODE = `export const isColorEnabled = (
  stream: { readonly isTTY?: boolean },
  env: NodeJS.ProcessEnv = process.env
): boolean => {
  if (env.NO_COLOR) {
    return false;
  }
  const force = env.FORCE_COLOR;
  if (force !== undefined) {
    return force !== "0" && force !== "false";
  }
  return stream.isTTY ?? false;
};

const createUi = (useColor: boolean) => {
  const ansi = (code: string) => (text: string) =>
    useColor ? \`\\u001B[\${code}m\${text}\\u001B[0m\` : text;
  // ... colours, icons and helpers built from ansi()
};

// stdout for command output, stderr for warnings and errors
export const { green, red, icons /* ... */ } = createUi(
  isColorEnabled(process.stdout)
);
export const stderrUi = createUi(isColorEnabled(process.stderr));`;

const PIPED_OUTPUT = `▸ myapp.dev  (3 secrets)
▸ myapp.prod  (2 secrets)`;

const NoEmojiPost = () => (
  <PostLayout
    lead={
      <p>
        A CLI prints a tidy list with a padlock in front of every line. On your
        colleague&apos;s terminal the padlock eats the space after it, or the
        cursor ends up one column to the left of where you are typing. Nothing
        is broken in the program. The program and the terminal disagree about
        how wide one character is.
      </p>
    }
    slug={SLUG}
  >
    <H2>A terminal is a grid</H2>
    <P>
      A terminal draws text into a grid of cells. Every program that writes to
      it, and every line editor that moves the cursor around in it, has to know
      how many cells each character takes. The usual answer comes from{" "}
      <Mono>wcwidth(3)</Mono>: 0 for combining marks, 1 for most characters, 2
      for wide ones such as CJK ideographs.
    </P>
    <P>
      The catch is that there is no single <Mono>wcwidth</Mono>. Your libc has
      one, which shells and line editors usually call. Terminal multiplexers and
      terminal emulators often ship their own tables. Each is built from some
      version of the Unicode data, and the versions don&apos;t always agree.
      Plain ASCII never trips over this. Emoji do, all the time.
    </P>

    <H2>Four ways an emoji breaks the grid</H2>
    <List>
      <li>
        <Strong>Width tables.</Strong> Unicode&apos;s East_Asian_Width property
        (UAX #11) classifies characters as Wide (W), Narrow (Na), Neutral (N) or
        Ambiguous (A), among others. Since Unicode 9.0, emoji that display as
        emoji by default are W. A component that still uses an older table
        counts them as 1 cell while the terminal draws 2.
      </li>
      <li>
        <Strong>Variation selectors.</Strong> Some characters, like 🛡 (U+1F6E1)
        and ⚠ (U+26A0), have text presentation by default. Add U+FE0F (VARIATION
        SELECTOR-16) and they become emoji. The selector itself has width 0, so{" "}
        <Mono>wcswidth</Mono> still says 1, while many terminals paint a
        two-cell colour glyph.
      </li>
      <li>
        <Strong>ZWJ sequences.</Strong> 👩‍💻 is three code points joined by a ZERO
        WIDTH JOINER. Summing per-code-point widths gives 4. A terminal that
        knows the sequence draws one 2-cell glyph; one that doesn&apos;t draws
        two.
      </li>
      <li>
        <Strong>Fonts.</Strong> Monospace programming fonts rarely include
        emoji, so the terminal falls back to a colour emoji font whose glyph
        doesn&apos;t fit the cell. Some terminals scale it down, some let it
        overflow into the next cell.
      </li>
    </List>
    <P>Here is what macOS&apos;s own libc reports for a few of them:</P>
    <DataTable
      caption="wcswidth from macOS libc (Darwin 27, en_US.UTF-8 locale). East_Asian_Width from Python's unicodedata (Unicode 16.0)."
      columns={WIDTH_COLUMNS}
      rows={WIDTH_ROWS}
    />
    <P>
      The 1s next to the VS16 sequences and the 4 next to the ZWJ sequence are
      where libc and a terminal that draws colour emoji are likely to disagree.
      When one line in a list is off by a cell, the columns after it no longer
      line up, and a line editor that guessed wrong puts the cursor in the wrong
      place.
    </P>

    <H2>What I changed in envsec</H2>
    <P>
      envsec&apos;s first icon set had 🔑 for keys, 🔒 for locks, 📁 for
      contexts, 🛡 for the doctor and ✅ for success. In March 2026 I replaced
      every emoji in the set with a geometric Unicode glyph in one commit (
      <Mono>6709620da</Mono>). An excerpt of the diff:
    </P>
    <CodeBlock code={DIFF} language="diff" />
    <P>
      The same commit added a rule to the agent instructions in the repo: all
      icons live in one <Mono>icons</Mono> object (today in{" "}
      <Mono>packages/core/src/ui.ts</Mono>), every glyph carries a comment with
      its code point, each is wrapped in its colour function, and emoji are not
      allowed. Here is the complete set:
    </P>
    <DataTable
      caption="All 27 entries of the icons object in packages/core/src/ui.ts. EAW = East_Asian_Width. Meaning is where the CLI uses each icon."
      columns={ICON_COLUMNS}
      rows={ICON_ROWS}
    />
    <P>
      None of these has the Emoji_Presentation property, and envsec never emits
      U+FE0F. The source tree has no variation selectors at all. Secret values
      can still contain emoji; envsec only declines to add its own.
    </P>

    <H2>Not a perfect set</H2>
    <P>
      I&apos;d like to say these glyphs are always one cell. They aren&apos;t.
      13 of the 24 distinct glyphs, including → ● ◆ ■ ▲ and ×, are East Asian
      Ambiguous. Ambiguous characters are one cell in most Western setups and
      two cells in many CJK ones, and several terminals (and Vim, via{" "}
      <Mono>ambiwidth</Mono>) let you choose. Four of them, ✔ ✖ ▪ and ▶, still
      carry the Emoji property: their default is text, but a renderer that
      ignores presentation defaults could still pick an emoji font.
    </P>
    <P>
      The trade is between failure modes. An emoji depends on the Unicode
      version, the font, the selector and the terminal, and can be wrong in a
      different way on every line. An ambiguous-width glyph depends on one
      setting, and when it is wrong, every line is wrong by the same amount.
    </P>

    <H2>Colour, NO_COLOR and pipes</H2>
    <P>
      Colour is plain ANSI SGR escapes, decided once per output stream when{" "}
      <Mono>ui.ts</Mono> loads:
    </P>
    <CodeBlock code={COLOR_CODE} language="ts" />
    <P>That gives three rules, in this order:</P>
    <List>
      <li>
        <Mono>NO_COLOR</Mono> set to any non-empty value turns colour off, as
        the{" "}
        <ExternalLink href="https://no-color.org/">
          NO_COLOR convention
        </ExternalLink>{" "}
        asks. An empty <Mono>NO_COLOR=</Mono> is ignored, which also matches it.
      </li>
      <li>
        <Mono>FORCE_COLOR</Mono> turns it on, unless it is <Mono>0</Mono> or{" "}
        <Mono>false</Mono>, which turn it off. That is how Node.js itself reads
        the variable.
      </li>
      <li>
        Otherwise colour is on only when the stream being written is a TTY:
        stdout for command output, stderr for warnings and errors.
      </li>
    </List>
    <P>
      Piping drops the escapes but keeps the glyphs, so the output of{" "}
      <Mono>envsec list | cat</Mono> is still readable:
    </P>
    <CodeBlock code={PIPED_OUTPUT} language="text" />
    <P>
      Two rough edges I found while checking this, both fixed in envsec 1.1.3.{" "}
      <Mono>FORCE_COLOR=0</Mono> used to force colour on, because the check only
      tested for a non-empty string, while libraries such as{" "}
      <ExternalLink href="https://github.com/chalk/supports-color">
        supports-color
      </ExternalLink>{" "}
      treat <Mono>0</Mono> as off. And there was one TTY test, on stdout, even
      for errors written to stderr: run envsec in a terminal with{" "}
      <Mono>2&gt; err.log</Mono> and the log file got escape codes, while{" "}
      <Mono>envsec env | …</Mono> printed its warnings to the terminal without
      colour. Each stream now gets its own palette. Scripts that want clean
      bytes can still set <Mono>NO_COLOR=1</Mono> or use <Mono>--json</Mono>{" "}
      where a command supports it.
    </P>

    <H2>In short</H2>
    <P>
      Emoji width depends on the Unicode version, the font, variation selectors
      and joiners, and the terminal, and the program printing them controls none
      of those. envsec uses 24 geometric glyphs with no emoji presentation,
      wrapped in ANSI colours that switch off with <Mono>NO_COLOR</Mono> or a
      pipe. They still have one known weak spot, ambiguous width, but they fail
      the same way on every line. For the other side of small CLI details, see
      how{" "}
      <Link className={LINK_CLASS} href="/blog/dynamic-shell-completions">
        envsec completes contexts and keys in bash, zsh and fish
      </Link>
      .
    </P>
  </PostLayout>
);

export default NoEmojiPost;
