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

const SLUG = "parsing-durations-and-generating-secrets";

export const metadata = postMetadata(SLUG);

const LINK_CLASS =
  "text-emerald-400 underline underline-offset-2 hover:text-emerald-300";

const ADD_EXPIRES = `envsec -c myapp.dev add stripe.key --expires 1y6mo
◆ Enter secret value: ************
✔ Secret "stripe.key" stored in context "myapp.dev"
  ◔ expires: 2028-04-06 14:17:31`;

const PARSER_CODE = `const UNIT_TO_DURATION: Record<string, (n: number) => Duration.Duration> = {
  d: (n) => Duration.days(n),
  h: (n) => Duration.hours(n),
  m: (n) => Duration.minutes(n),
  mo: (n) => Duration.days(n * 30),
  w: (n) => Duration.weeks(n),
  y: (n) => Duration.days(n * 365),
};

const SEGMENT_PATTERN = /^(?<amount>\\d+)(?<unit>mo|[mhdwy])(?<rest>.*)$/u;

// inside parseDuration, after trim() and toLowerCase():
while (remaining.length > 0) {
  const { amount, unit, rest } =
    SEGMENT_PATTERN.exec(remaining)?.groups ?? {};
  if (!(amount && unit)) {
    return yield* new InvalidDurationError({ input, message: "…" });
  }
  total = Duration.sum(total, UNIT_TO_DURATION[unit](Number(amount)));
  if (Duration.isGreaterThan(total, MAX_DURATION)) {
    // MAX_DURATION is 1000 years
    return yield* new InvalidDurationError({ input, message: "…" });
  }
  remaining = rest ?? "";
}`;

const UNIT_COLUMNS = [
  { label: "Unit" },
  { label: "Meaning" },
  { label: "Fixed length" },
] as const;

const UNIT_ROWS = [
  ["m", "minutes", "60 s"],
  ["h", "hours", "60 min"],
  ["d", "days", "24 h"],
  ["w", "weeks", "7 d"],
  ["mo", "months", "30 d"],
  ["y", "years", "365 d"],
] as const;

const INPUT_COLUMNS = [{ label: "Input" }, { label: "Result" }] as const;

const INPUT_ROWS = [
  ["1y6mo", "545 days"],
  ["6mo1y", "545 days (order is free)"],
  ["2w3d", "17 days"],
  ["1d12h", "1 day 12 hours"],
  ["1h1h", "2 hours (repeats add up)"],
  ["7D", "7 days (lowercased first)"],
  ["1M", "1 minute, not 1 month"],
  ["0d", "zero: expires immediately"],
  ["1.5h", "error"],
  ["1 d", "error"],
  ["-1d", "error"],
  ["30", "error (no unit)"],
  ["1001y", "error (more than 1000y)"],
] as const;

const EXPIRES_AT_CODE = `export const expiresAtFromNow = (duration: Duration.Duration): string => {
  const future = DateTime.addDuration(DateTime.nowUnsafe(), duration);
  return DateTime.formatIso(future)
    .replace("T", " ")
    .replace("Z", "")
    .slice(0, 19);
};`;

const EXPIRING_SQL = `SELECT key, created_at, updated_at, expires_at
FROM secrets
WHERE env = ? AND expires_at IS NOT NULL AND expires_at <= ?
ORDER BY expires_at`;

const AUDIT_OUTPUT = `envsec -c myapp.dev audit --within 1y6mo
◎ Secrets expiring within 1y6mo in "myapp.dev":

  ✖ old.token  expired 0m ago
  ◔ session.token  expires in 16d
  ◔ api.key  expires in 89d
  ◔ stripe.key  expires in 544d

▪ 1 expired, 3 expiring soon (4 total)`;

const SECRET_USAGE = `# Standalone: print a value and store nothing
envsec secret
uB1aUIMDgS2ybVPGAQQC8UT7XmdAOOrM

envsec secret --special --length 24
uLU%d2rV9&v#EABrR@mbm$SI

# Pipe it straight to the clipboard on macOS
envsec secret --length 48 | pbcopy

# Store mode: needs both a context and a key
envsec -c myapp.dev secret api.key --prefix demo_ -l 24 --expires 90d
⬡ Generated 24-char secret (alphanumeric)
  › prefix: demo_
✔ Secret "api.key" stored in context "myapp.dev"
  ◔ expires: 2027-01-07 13:17:31
  ◆ demo_5kLliTjcHt6h96ZYBXPnC7Xh`;

const GENERATE_CODE = `const generateSecret = (length: number, charset: string): string => {
  const maxValid = 256 - (256 % charset.length);
  const result: string[] = [];

  while (result.length < length) {
    const bytes = randomBytes(length * 2);
    for (const byte of bytes) {
      if (result.length >= length) {
        break;
      }
      if (byte < maxValid) {
        result.push(charset[byte % charset.length] as string);
      }
    }
  }

  return result.join("");
};`;

const BIAS_COLUMNS = [
  { label: "Character set" },
  { label: "Size" },
  { label: "Accepted bytes" },
  { label: "Discarded" },
  { label: "Bias without rejection" },
] as const;

const BIAS_ROWS = [
  [
    "default (alphanumeric)",
    "62",
    "0–247",
    "3.1%",
    "8 chars at 5/256 vs 4/256",
  ],
  ["--special", "70", "0–209", "18.0%", "46 chars at 4/256 vs 3/256"],
  ["--all-chars", "93", "0–185", "27.3%", "70 chars at 3/256 vs 2/256"],
] as const;

const ENTROPY_COLUMNS = [
  { label: "Settings" },
  { label: "Bits per char" },
  { label: "Length" },
  { highlight: true, label: "Entropy" },
] as const;

const ENTROPY_ROWS = [
  ["default (62 chars)", "5.954", "32", "190.5 bits"],
  ["--special (70 chars)", "6.129", "32", "196.1 bits"],
  ["--all-chars (93 chars)", "6.539", "32", "209.3 bits"],
  ["--special -l 64", "6.129", "64", "392.3 bits"],
  ["--all-chars -l 128", "6.539", "128", "837.0 bits"],
] as const;

const DurationsAndSecretsPost = () => (
  <PostLayout
    lead={
      <p>
        Two small jobs come up in any tool that handles credentials: writing
        down when a key should be rotated, and making a new key that nobody can
        guess. Both look like ten lines of code. Both hide a trap: an ambiguous
        unit in the first, a skewed random number in the second.
      </p>
    }
    slug={SLUG}
  >
    <P>
      This post walks through how envsec handles both: the duration parser
      behind <Mono>add --expires</Mono> and <Mono>audit --within</Mono>, and the{" "}
      <Mono>secret</Mono> command that generates random values. All the code
      shown is from the repository, trimmed for length.
    </P>

    <H2>Durations a human would type</H2>
    <P>
      When I store an API key that expires, I want to type the expiry the way I
      would say it: <Mono>90d</Mono>, <Mono>6mo</Mono>, or <Mono>1y6mo</Mono>{" "}
      for a key that is valid a year and a half. envsec accepts compact strings
      made of one or more segments, each one a whole number followed by a unit:
    </P>
    <DataTable columns={UNIT_COLUMNS} rows={UNIT_ROWS} />
    <TerminalBlock code={ADD_EXPIRES} />
    <P>
      The parser lives in <Mono>packages/core/src/domain/duration.ts</Mono>. It
      lowercases and trims the input, then eats it one segment at a time with an
      anchored regular expression, summing each piece into an Effect{" "}
      <Mono>Duration</Mono>:
    </P>
    <CodeBlock code={PARSER_CODE} language="ts" />

    <H3>m or mo?</H3>
    <P>
      Minutes and months share a first letter, so the regex has to decide what{" "}
      <Mono>1mo</Mono> means. JavaScript tries the branches of an alternation
      from left to right, and the unit group is <Mono>mo|[mhdwy]</Mono>: the
      two-letter <Mono>mo</Mono> is tried first. If the order were reversed,{" "}
      <Mono>1mo</Mono> would match as one minute and the parser would then fail
      on the leftover <Mono>o</Mono>.
    </P>
    <P>
      The flip side is case. Because the input is lowercased before matching,{" "}
      <Mono>1M</Mono> is one minute, not one month. If you come from a world
      where a capital M means month, that will surprise you. Use <Mono>mo</Mono>{" "}
      and the ambiguity never comes up.
    </P>

    <H3>What it accepts and what it rejects</H3>
    <P>
      Segments can come in any order and can repeat; they are added up. Anything
      that is not digits followed by a known unit is an{" "}
      <Mono>InvalidDurationError</Mono>, which the CLI prints as a single line
      on stderr with exit code 1:
    </P>
    <DataTable columns={INPUT_COLUMNS} rows={INPUT_ROWS} />
    <P>
      No fractions, no spaces between number and unit, no negative values.{" "}
      <Mono>0d</Mono> is accepted, and it is useful:{" "}
      <Mono>audit --within 0d</Mono> means &quot;only what has already
      expired&quot;.
    </P>
    <P>
      There is also an upper limit of <Mono>1000y</Mono>, added in envsec 1.1.3.
      Before it, <Mono>--expires 99999999999999y</Mono> parsed without complaint
      and then crashed with <Mono>RangeError: Invalid time value</Mono> when
      envsec computed the expiry date: a JavaScript <Mono>Date</Mono> ends in
      the year 275760, and that duration goes far past it. A thousand years is
      generous, and it keeps every expiry a four-digit year, which the text
      comparison in the next section relies on.
    </P>

    <H2>A month is 30 days</H2>
    <P>
      The table above says it plainly: <Mono>mo</Mono> is 30 days and{" "}
      <Mono>y</Mono> is 365 days. The parser builds a fixed{" "}
      <Mono>Duration</Mono>, and <Mono>DateTime.addDuration</Mono> adds it as a
      number of milliseconds. Nothing in this path knows about calendars.
    </P>
    <P>
      So <Mono>1y6mo</Mono> is 545 days. Added on 9 October 2026, it lands on 6
      April 2028, three days before the calendar answer of 9 April. Leap days
      and 31-day months also shift the result by a day or so.
    </P>
    <P>
      I am fine with that trade-off. An expiry in envsec is a reminder to
      rotate, not a deadline enforced to the second. Fixed lengths make every
      duration comparable to every other, which is what{" "}
      <Mono>audit --within</Mono> needs, and they avoid the classic calendar
      question of what &quot;one month after 31 January&quot; means. If you need
      an exact date, use days: <Mono>--expires 548d</Mono> means 548 days, no
      interpretation involved.
    </P>

    <H2>Storing and showing the date</H2>
    <P>
      The expiry is computed once, when you run <Mono>add</Mono> or{" "}
      <Mono>secret</Mono>, and stored in the SQLite metadata database (never in
      the keychain, which only holds the value):
    </P>
    <CodeBlock code={EXPIRES_AT_CODE} language="ts" />
    <P>
      The stored string is UTC in the form <Mono>YYYY-MM-DD HH:mm:ss</Mono>,
      with no time-zone suffix. That shape sorts correctly as plain text, so
      finding what expires within a window is a string comparison against a
      cutoff computed the same way:
    </P>
    <CodeBlock code={EXPIRING_SQL} language="sql" />
    <P>
      UTC is right for storage and wrong for people. Early versions printed the
      raw value with a <Mono>UTC</Mono> label, which meant doing time-zone
      arithmetic in your head. Now <Mono>add</Mono> and <Mono>secret</Mono> pass
      it through <Mono>formatLocalDateTime</Mono>, which converts it to the
      system time zone. The <Mono>2028-04-06 14:17:31</Mono> in the example
      above is Central European Summer Time; the database holds{" "}
      <Mono>12:17:31</Mono>. The printed time carries no zone label, so it is
      only unambiguous on the machine that printed it.
    </P>

    <H3>How audit reports it</H3>
    <P>
      <Mono>envsec audit</Mono> lists secrets that have expired or will expire
      within a window. The window defaults to <Mono>30d</Mono> and goes through
      the same parser, so <Mono>--within 1y6mo</Mono> works too. Without a
      context (no <Mono>--context</Mono> and no <Mono>ENVSEC_CONTEXT</Mono>), it
      checks every context.
    </P>
    <TerminalBlock code={AUDIT_OUTPUT} />
    <P>
      The relative times come from <Mono>formatTimeDistance</Mono>, which shows
      the largest whole unit (days, hours or minutes) and rounds down. That is
      why a key stored with <Mono>--expires 90d</Mono> shows <Mono>in 89d</Mono>{" "}
      a moment later: it is 89 days and 23-something hours away.{" "}
      <Mono>--json</Mono> gives you the raw UTC timestamp and an{" "}
      <Mono>expired</Mono> boolean instead.
    </P>
    <P>
      <Strong>Expiry is advisory.</Strong> envsec never deletes or blocks an
      expired secret. <Mono>envsec get</Mono> still prints the value, and adds a
      warning on stderr when the secret has expired or expires within 24 hours.{" "}
      <Mono>list</Mono> shows the same status inline. Rotating the key is up to
      you.
    </P>

    <H2>Generating a secret you can&apos;t guess</H2>
    <P>
      The other half is <Mono>envsec secret</Mono>. It generates a random string
      and, when you give it both a context and a key, stores it like{" "}
      <Mono>add</Mono> would. The flags:
    </P>
    <List>
      <li>
        <Mono>--length</Mono>, <Mono>-l</Mono>: number of random characters,
        default 32, allowed range 1 to 4096
      </li>
      <li>
        <Mono>--prefix</Mono>, <Mono>-p</Mono>: a fixed string prepended to the
        value, such as <Mono>sk_</Mono>
      </li>
      <li>
        <Mono>--expires</Mono>, <Mono>-e</Mono>: the same durations as above
      </li>
      <li>
        <Mono>--alphanumeric</Mono>, <Mono>-a</Mono>: <Mono>[a-zA-Z0-9]</Mono>,
        which is already the default
      </li>
      <li>
        <Mono>--special</Mono>, <Mono>-s</Mono>: alphanumeric plus{" "}
        <Mono>!@#$%^&amp;*</Mono>
      </li>
      <li>
        <Mono>--all-chars</Mono>, <Mono>-A</Mono>: a 93-character set of
        printable ASCII
      </li>
    </List>
    <TerminalBlock code={SECRET_USAGE} />
    <P>
      If you pass more than one character-set flag, the largest set wins:{" "}
      <Mono>--all-chars</Mono>, then <Mono>--special</Mono>. In store mode the
      generated value is also printed on the last line, so it ends up in your
      terminal scrollback. If only one of context and key is present, the
      command prints the value and stores nothing.
    </P>

    <H3>Where the randomness comes from</H3>
    <P>
      The bytes come from <Mono>randomBytes</Mono> in <Mono>node:crypto</Mono>,
      which the{" "}
      <ExternalLink href="https://nodejs.org/api/crypto.html#cryptorandombytessize-callback">
        Node.js documentation
      </ExternalLink>{" "}
      describes as cryptographically strong pseudorandom data. Not{" "}
      <Mono>Math.random()</Mono>, which makes no such promise. The npm package
      runs on Node and the standalone binary on Bun, which implements the same
      module.
    </P>
    <P>
      Random bytes are only half the job, though. A byte has 256 values and the
      default character set has 62. Turning one into the other is where
      hand-rolled generators can go wrong.
    </P>

    <H3>Modulo bias, and the loop that avoids it</H3>
    <P>
      The obvious mapping is <Mono>charset[byte % 62]</Mono>. The problem is
      that 256 = 4 × 62 + 8. The byte values 0 to 247 cover each of the 62
      characters exactly four times. The last eight values, 248 to 255, wrap
      around and land on the first eight characters again. Those eight
      characters, <Mono>a</Mono> to <Mono>h</Mono>, would each come up with
      probability 5/256 instead of 4/256: 25% more often than the rest.
    </P>
    <P>
      In entropy terms the damage is small. The skewed distribution carries
      about 5.950 bits per character instead of 5.954, roughly 0.14 bits lost
      over 32 characters. The reason to fix it anyway is that the fix costs
      almost nothing, and with it the output is exactly uniform, so the entropy
      numbers below are exact instead of approximately right. envsec uses
      rejection sampling: it computes the largest multiple of the charset size
      that fits in a byte and throws away any byte at or above it.
    </P>
    <CodeBlock code={GENERATE_CODE} language="ts" />
    <P>
      For the default set, <Mono>maxValid</Mono> is 256 − (256 mod 62) = 248.
      Bytes 248 to 255 are dropped, each character keeps exactly four byte
      values, and the distribution is uniform. Each round draws twice as many
      bytes as needed. At the default length of 32, even{" "}
      <Mono>--all-chars</Mono>, which discards the most, needs a second round
      about 3 times in 100,000:
    </P>
    <DataTable
      caption="Discarded = share of random bytes rejected. Bias = what the plain modulo would have done."
      columns={BIAS_COLUMNS}
      rows={BIAS_ROWS}
    />
    <P>
      The bias grows with the set size. With <Mono>--all-chars</Mono> and a
      plain modulo, 70 of the 93 characters would be 50% more likely than the
      other 23, costing about 0.6 bits over 32 characters. Rejection sampling
      removes it in every case.
    </P>

    <H3>How many bits is the default?</H3>
    <P>
      With a uniform, independent choice per character, the entropy of a secret
      is the length times log₂ of the charset size. For the defaults:
    </P>
    <CodeBlock
      code={`log2(62) ≈ 5.954 bits per character
5.954 × 32 ≈ 190.5 bits`}
      language="text"
    />
    <DataTable columns={ENTROPY_COLUMNS} rows={ENTROPY_ROWS} />
    <P>
      190 bits is well past the 128 bits usually quoted as the target for
      symmetric keys. Two details matter when you read these numbers:
    </P>
    <List>
      <li>
        <Strong>The prefix adds nothing.</Strong> <Mono>sk_</Mono> is the same
        in every value, so a 3-character prefix on 32 random characters is still
        190.5 bits.
      </li>
      <li>
        <Strong>&quot;All printable&quot; is 93, not 95.</Strong> The{" "}
        <Mono>--all-chars</Mono> set leaves out the space and the backslash. It
        still includes quotes and the backtick, so it needs care when you paste
        it into a shell.
      </li>
    </List>
    <P>
      Going from the default set to <Mono>--all-chars</Mono> adds less than 0.6
      bits per character. If you need more entropy, adding length buys more than
      adding symbols, and an alphanumeric secret survives being pasted into
      YAML, URLs and shell commands without escaping.
    </P>

    <H2>In short</H2>
    <List>
      <li>
        Durations are compact segments (<Mono>30m</Mono>, <Mono>2w3d</Mono>,{" "}
        <Mono>1y6mo</Mono>). <Mono>mo</Mono> beats <Mono>m</Mono> because the
        regex tries it first; input is lowercased, so <Mono>1M</Mono> is a
        minute.
      </li>
      <li>
        Months are 30 days and years 365. Expiry is stored in UTC, printed in
        local time by <Mono>add</Mono>, and never enforced.
      </li>
      <li>
        <Mono>envsec secret</Mono> uses <Mono>node:crypto</Mono> random bytes
        with rejection sampling, so there is no modulo bias. The default is 32
        alphanumeric characters, about 190 bits.
      </li>
    </List>
    <P>
      Every flag is listed in the{" "}
      <Link className={LINK_CLASS} href="/docs">
        documentation
      </Link>
      . If you are curious how the commands themselves are wired together, I
      wrote about that in{" "}
      <Link className={LINK_CLASS} href="/blog/building-a-cli-with-effect-4">
        Building a CLI with Effect 4
      </Link>
      .
    </P>
  </PostLayout>
);

export default DurationsAndSecretsPost;
