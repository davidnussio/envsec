import { createRequire } from "node:module";

/**
 * Inlined by `bun build --define` when compiling the standalone binary,
 * whose virtual filesystem has no package.json to read at run time.
 */
declare const ENVSEC_VERSION: string | undefined;
declare const EFFECT_VERSION: string | undefined;

const require = createRequire(import.meta.url);

const readVersion = (specifier: string): string =>
  (require(specifier) as { version: string }).version;

export const envsecVersion: string =
  typeof ENVSEC_VERSION === "string"
    ? ENVSEC_VERSION
    : readVersion("../package.json");

/** The Effect runtime actually resolved at run time (not the declared range). */
export const effectVersion: string =
  typeof EFFECT_VERSION === "string"
    ? EFFECT_VERSION
    : readVersion("effect/package.json");
