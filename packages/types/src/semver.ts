/**
 * Shared semver-ish compare util (T115 card: "semver compare util in
 * packages/types"). Pure, zero dependency (no `semver` package -- CLAUDE §2
 * over-engineering rule; the card's grammar is a subset of full semver).
 *
 * Grammar (applied to the TRIMMED input):
 * `/^(\d+)\.(\d+)\.(\d+)(?:\+([0-9A-Za-z][0-9A-Za-z.-]*))?$/`
 * -- i.e. `x.y.z` with an OPTIONAL `+build` suffix. Pre-release tags
 * (`-beta`) are deliberately NOT supported: store marketing versions cannot
 * carry one, so full semver pre-release precedence would be unused code
 * (plan D3). Anything that doesn't match this grammar on EITHER side fails
 * OPEN -- `compareAppVersions` returns `null`, and `isVersionBelow` (which
 * callers use to decide whether to gate a user) returns `false`. A version
 * string this codebase cannot parse must NEVER be able to lock someone out
 * of the app, including mid-emergency (CLAUDE.md §7).
 */

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:\+([0-9A-Za-z][0-9A-Za-z.-]*))?$/;

export type VersionOrder = -1 | 0 | 1;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  build: string | undefined;
}

function parse(version: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(version.trim());

  if (match === null) {
    return null;
  }

  const [, major, minor, patch, build] = match;

  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    build,
  };
}

/** A build metadata string is comparable only when it is purely numeric (e.g. `"7"`, `"007"`). Anything else (e.g. `"abc"`, `"1e3"`) is ignored (semver §10 precedence + fail-open). */
function isNumericBuild(build: string): boolean {
  return /^\d+$/.test(build);
}

/**
 * Compares two version strings. Returns `-1` if `a < b`, `0` if equal, `1`
 * if `a > b`, or `null` if EITHER side fails to parse (fail-open signal for
 * callers -- see header comment).
 *
 * Core (`major.minor.patch`) is compared numerically. When the cores are
 * equal, build metadata is compared numerically ONLY when BOTH sides carry
 * one and both are purely numeric (`+7 < +10`; `+007 == +7`). Otherwise
 * build metadata is ignored and the result is `0` -- a build number that is
 * not visible on both sides can never gate (fail-open).
 */
export function compareAppVersions(a: string, b: string): VersionOrder | null {
  const parsedA = parse(a);
  const parsedB = parse(b);

  if (parsedA === null || parsedB === null) {
    return null;
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }

  if (
    parsedA.build !== undefined &&
    parsedB.build !== undefined &&
    isNumericBuild(parsedA.build) &&
    isNumericBuild(parsedB.build)
  ) {
    const buildA = Number(parsedA.build);
    const buildB = Number(parsedB.build);

    if (buildA !== buildB) {
      return buildA > buildB ? 1 : -1;
    }
  }

  return 0;
}

/**
 * `true` ONLY when both versions parse AND `current < target`. Any doubt
 * (either side malformed) resolves to `false` -- fail OPEN, never fail
 * closed (CLAUDE.md §7 / plan Risk R1).
 */
export function isVersionBelow(current: string, target: string): boolean {
  return compareAppVersions(current, target) === -1;
}
