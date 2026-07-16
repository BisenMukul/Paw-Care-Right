/**
 * Min-supported-version comparison (T079 plan decision 3 / Safety R3). Pure,
 * no dependency (no `semver` package): parses `x.y.z` numeric triples and
 * fails OPEN on every uncertainty -- ANY parse failure on either side means
 * `isUpdateRequired` returns `false`, so a corrupt/odd version string can
 * NEVER lock a user (including one mid-emergency) out of the app.
 */

/** Parses a `x.y.z` version string into a numeric triple, or `null` if it doesn't parse cleanly. */
function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());

  if (match === null) {
    return null;
  }

  const [, major, minor, patch] = match;

  return [Number(major), Number(minor), Number(patch)];
}

/**
 * Compares two version strings. Returns `-1` if `a < b`, `0` if equal, `1`
 * if `a > b`, or `null` if EITHER fails to parse (fail-open signal for the
 * caller).
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (parsedA === null || parsedB === null) {
    return null;
  }

  const [aMajor, aMinor, aPatch] = parsedA;
  const [bMajor, bMinor, bPatch] = parsedB;

  if (aMajor !== bMajor) {
    return aMajor > bMajor ? 1 : -1;
  }
  if (aMinor !== bMinor) {
    return aMinor > bMinor ? 1 : -1;
  }
  if (aPatch !== bPatch) {
    return aPatch > bPatch ? 1 : -1;
  }

  return 0;
}

/**
 * `true` ONLY when both versions parse AND `current < min`. Any parse
 * failure (malformed current, malformed min, non-numeric segments) resolves
 * to `false` -- fail OPEN, never fail closed (CLAUDE.md §7 / plan Risk R3).
 */
export function isUpdateRequired(current: string, min: string): boolean {
  return compareVersions(current, min) === -1;
}
