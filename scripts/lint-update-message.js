#!/usr/bin/env node
/**
 * T116: zero-dependency update-message linter for the OTA publish CI jobs
 * (docs/OTA_UPDATES.md §8.4: "Update descriptions follow `Txxx/Mx: summary
 * [critical?]` so every shipped bundle maps to journal history"). CommonJS,
 * Node 22, no dependencies (CLAUDE.md §2 rule 7 — mirrors the
 * `scripts/scan-secrets.js` precedent exactly: CJS, `"use strict"`, exports
 * for tests, a CLI entry only when invoked directly, invoked in CI as
 * `node scripts/lint-update-message.js …` with no package.json script entry).
 *
 * Naming: user-facing identifiers in this file follow CLAUDE.md §1a — this
 * script is a CLI tool, so it prints no `Bombay Pet Company` display string
 * at all; nothing here needs the shared constant.
 *
 * CLI:
 *   node scripts/lint-update-message.js --message "<msg>"
 *     -> exit 0 if <msg> is a valid update message, else exit 1 printing
 *        `lint-update-message: <reason>` (and the expected form) to stderr.
 *   node scripts/lint-update-message.js --from-commit "<subject>"
 *     -> derives a conforming message from a commit subject and prints it to
 *        stdout with no trailing prose (safe for `MESSAGE="$(…)"`), exit 0;
 *        on failure exit 1 with the reason on stderr.
 *   Any other/absent argument -> exit 1 with a usage line on stderr (mirrors
 *   `fingerprint-diff.sh`'s "unknown argument" behavior).
 * No `|| true`-style masking anywhere.
 */

"use strict";

/**
 * The update-message convention (OTA_UPDATES §8.4): `Txxx/Mx: summary
 * [critical?]`. This single regex captures the OVERALL shape; the finer
 * rules below (whitespace, length, exact-suffix critical casing, minimum
 * summary length) are enforced explicitly in `validateUpdateMessage` because
 * a pure regex cannot cleanly express "not a known placeholder position" for
 * the `[critical]` marker.
 */
const UPDATE_MESSAGE_PATTERN = /^(T\d{3}|M\d{1,2}): \S.*?( \[critical\])?$/;

const MAX_MESSAGE_LENGTH = 120;
const CRITICAL_SUFFIX = " [critical]";
const ID_PREFIX_PATTERN = /^(T\d{3}|M\d{1,2}): /;

/**
 * @param {unknown} message
 * @returns {{ok: boolean, reason?: string}}
 */
function validateUpdateMessage(message) {
  if (typeof message !== "string") {
    return { ok: false, reason: "message must be a string" };
  }
  if (message.length === 0) {
    return { ok: false, reason: "message must not be empty" };
  }
  if (/\r|\n/.test(message)) {
    return { ok: false, reason: "message must be a single line (no embedded newline)" };
  }
  if (message.trim() !== message) {
    return { ok: false, reason: "message must not have leading or trailing whitespace" };
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: `message must be at most ${MAX_MESSAGE_LENGTH} characters` };
  }

  const idMatch = ID_PREFIX_PATTERN.exec(message);
  if (!idMatch) {
    return {
      ok: false,
      reason:
        'message must start with a task/milestone id and ": ", e.g. "T116: summary" or "M10: summary" (uppercase id, exactly 3 digits for Txxx, 1-2 digits for Mx)',
    };
  }

  let rest = message.slice(idMatch[0].length);

  const lowerRest = rest.toLowerCase();
  if (lowerRest.includes("[critical]")) {
    if (!rest.endsWith(CRITICAL_SUFFIX)) {
      return {
        ok: false,
        reason: '"[critical]" is only allowed as an exact lowercase suffix " [critical]" at the very end of the message',
      };
    }
    rest = rest.slice(0, rest.length - CRITICAL_SUFFIX.length);
  }

  const nonSpaceCount = rest.replace(/\s/g, "").length;
  if (nonSpaceCount < 3) {
    return { ok: false, reason: "summary must contain at least 3 non-space characters after the colon" };
  }

  if (!UPDATE_MESSAGE_PATTERN.test(message)) {
    return {
      ok: false,
      reason: "message does not match the required convention Txxx/Mx: summary [critical]",
    };
  }

  return { ok: true };
}

/**
 * Derives a conforming update message from a (possibly conventional-commit)
 * subject line. Only the text before the first newline is considered. Fails
 * when no `Txxx`/`Mx` id token is found, or no summary text remains.
 * Guarantee: the returned message never contains a newline.
 *
 * @param {unknown} commitSubject
 * @returns {{ok: boolean, message?: string, reason?: string}}
 */
function deriveUpdateMessage(commitSubject) {
  if (typeof commitSubject !== "string") {
    return { ok: false, reason: "commit subject must be a string" };
  }

  const firstLine = (commitSubject.split(/\r?\n/)[0] ?? "").trim();

  let working = firstLine;
  let hadCritical = false;
  const criticalSuffixMatch = /\s*\[critical\]\s*$/i.exec(working);
  if (criticalSuffixMatch) {
    hadCritical = true;
    working = working.slice(0, criticalSuffixMatch.index);
  }

  // Strip a leading conventional-commit prefix, e.g. "feat(ota)!: ".
  const conventionalMatch = /^\w+(\([^)]*\))?!?:\s*/.exec(working);
  const afterConventional = conventionalMatch ? working.slice(conventionalMatch[0].length) : working;

  const idPattern = /\b(T\d{3}|M\d{1,2})\b/;
  const idMatch = idPattern.exec(afterConventional);
  if (!idMatch) {
    return { ok: false, reason: "no Txxx/Mx task or milestone id found in the commit subject" };
  }

  let remainder = afterConventional.slice(idMatch.index + idMatch[0].length);
  remainder = remainder.replace(/^[:\-\s]+/, "");
  remainder = remainder.replace(/\s+/g, " ").trim();

  if (remainder.length === 0) {
    return { ok: false, reason: "no summary text found after the task/milestone id" };
  }

  let message = `${idMatch[0]}: ${remainder}`;
  if (hadCritical) {
    message = `${message}${CRITICAL_SUFFIX}`;
  }

  // Defense in depth: the derived message must never carry a newline.
  message = message.replace(/[\r\n]/g, " ");

  return { ok: true, message };
}

function usageAndExit(reason) {
  process.stderr.write(
    `lint-update-message: ${reason} -- usage: node scripts/lint-update-message.js --message "<msg>" | --from-commit "<subject>"\n`,
  );
  process.exitCode = 1;
}

function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--message" && args.length === 2) {
    const result = validateUpdateMessage(args[1]);
    if (!result.ok) {
      process.stderr.write(`lint-update-message: ${result.reason}\n`);
      process.stderr.write('expected form: Txxx/Mx: summary [critical] (e.g. "T116: CI publish pipeline")\n');
      process.exitCode = 1;
      return;
    }
    process.exitCode = 0;
    return;
  }

  if (args[0] === "--from-commit" && args.length === 2) {
    const derived = deriveUpdateMessage(args[1]);
    if (!derived.ok) {
      process.stderr.write(`lint-update-message: ${derived.reason}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${derived.message}\n`);
    process.exitCode = 0;
    return;
  }

  usageAndExit(args.length === 0 ? "no arguments given" : `unknown argument '${args[0]}'`);
}

module.exports = { UPDATE_MESSAGE_PATTERN, validateUpdateMessage, deriveUpdateMessage };

if (require.main === module) {
  main();
}
