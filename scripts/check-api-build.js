#!/usr/bin/env node
/**
 * T116: zero-dependency pre-flight API build check for the production OTA
 * publish job (docs/OTA_UPDATES.md §5.3 — "deploy backend first; the promote
 * job checks `GET /health` includes the required API build id"). CommonJS,
 * Node 22, no dependencies (CLAUDE.md §2 rule 7), mirrors the
 * `scripts/scan-secrets.js` precedent: CJS, `"use strict"`, exports for
 * tests, CLI when invoked directly, no package.json script entry.
 *
 * CLI:
 *   node scripts/check-api-build.js --body "<json>" --expect "<sha>"
 *     -> exit 0 if the response body's `status` is "ok" and its `buildId`
 *        exactly equals `<sha>`; else exit 1 printing
 *        `check-api-build: <reason>` to stderr. Unknown/absent args -> exit 1
 *        usage.
 *
 * All rules fail-closed: a malformed body, a missing field, or an empty
 * expectation is always a rejection, never a thrown exception.
 */

"use strict";

/**
 * @param {{body: unknown, expected: unknown}} args
 * @returns {{ok: boolean, reason?: string}}
 */
function checkApiBuild(args) {
  const { body, expected } = args;

  if (typeof body !== "string" || body.trim().length === 0) {
    return { ok: false, reason: "response body must be a non-empty string" };
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, reason: "response body is not valid JSON" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "response body did not parse to an object" };
  }

  const record = /** @type {Record<string, unknown>} */ (parsed);

  if (record.status !== "ok") {
    return { ok: false, reason: `expected status "ok", got ${JSON.stringify(record.status)}` };
  }

  if (typeof record.buildId !== "string" || record.buildId.length === 0) {
    return { ok: false, reason: "response body has no non-empty buildId" };
  }

  if (typeof expected !== "string" || expected.length === 0) {
    return { ok: false, reason: "expected build id must be a non-empty string" };
  }

  if (record.buildId !== expected) {
    return {
      ok: false,
      reason: `API buildId ${JSON.stringify(record.buildId)} does not exactly match the expected ${JSON.stringify(expected)}`,
    };
  }

  return { ok: true };
}

function usageAndExit(reason) {
  process.stderr.write(
    `check-api-build: ${reason} -- usage: node scripts/check-api-build.js --body "<json>" --expect "<sha>"\n`,
  );
  process.exitCode = 1;
}

function main() {
  const args = process.argv.slice(2);
  const bodyIndex = args.indexOf("--body");
  const expectIndex = args.indexOf("--expect");

  if (bodyIndex === -1 || expectIndex === -1 || args.length !== 4) {
    usageAndExit(args.length === 0 ? "no arguments given" : "expected exactly --body <json> --expect <sha>");
    return;
  }

  const body = args[bodyIndex + 1];
  const expected = args[expectIndex + 1];

  const result = checkApiBuild({ body, expected });
  if (!result.ok) {
    process.stderr.write(`check-api-build: ${result.reason}\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

module.exports = { checkApiBuild };

if (require.main === module) {
  main();
}
