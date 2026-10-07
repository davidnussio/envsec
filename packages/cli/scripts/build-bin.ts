/**
 * Compile the CLI into standalone executables with `bun build --compile`:
 * the Bun runtime is embedded, so neither Node.js nor node_modules are
 * needed to run them.
 *
 *   bun scripts/build-bin.ts                  # current platform only
 *   bun scripts/build-bin.ts --all            # every supported target
 *   bun scripts/build-bin.ts bun-linux-x64    # specific targets
 *
 * Expects @envsec/core and @envsec/tui to be built (`pnpm run build`).
 */
import path from "node:path";

import effectPkg from "effect/package.json" with { type: "json" };

import pkg from "../package.json" with { type: "json" };

const TARGETS = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-arm64",
  "bun-linux-arm64-musl",
  "bun-linux-x64",
  "bun-linux-x64-musl",
  "bun-windows-x64",
] as const;

const BUN_PREFIX = /^bun-/u;

const cliDir = path.join(import.meta.dir, "..");
const entry = path.join(cliDir, "src", "main.ts");
const outDir = path.join(cliDir, "release");

const args = process.argv.slice(2);
const requested = args.includes("--all")
  ? [...TARGETS]
  : args.filter((arg) => !arg.startsWith("--"));

for (const target of requested) {
  if (!(TARGETS as readonly string[]).includes(target)) {
    throw new Error(
      `Unknown target "${target}". Supported: ${TARGETS.join(", ")}`
    );
  }
}

const defines = [
  `--define=ENVSEC_VERSION=${JSON.stringify(pkg.version)}`,
  `--define=EFFECT_VERSION=${JSON.stringify(effectPkg.version)}`,
];

const build = async (target?: string): Promise<void> => {
  const name = target ? `envsec-${target.replace(BUN_PREFIX, "")}` : "envsec";
  const outfile = path.join(outDir, name);
  const targetFlag = target ? [`--target=${target}`] : [];
  await Bun.$`bun build ${entry} --compile --minify --sourcemap ${targetFlag} ${defines} --outfile ${outfile}`;
};

await (requested.length === 0
  ? build()
  : Promise.all(requested.map((target) => build(target))));
