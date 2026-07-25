#!/usr/bin/env node
/**
 * T096: repo-owned, zero-dependency secrets scanner.
 *
 * CommonJS, Node 22, no dependencies (CLAUDE.md §2 rule 7 — a secrets
 * scanner is exactly the wrong place to add supply-chain risk; see
 * docs/security/README.md D4 for the full rationale vs. gitleaks/trufflehog).
 *
 * Exports `SECRET_RULES` + `scanText()`/`scanFiles()` for tests, and runs as
 * a CLI when invoked directly:
 *   node scripts/scan-secrets.js --staged   # git diff --cached, ACM files
 *   node scripts/scan-secrets.js --tracked   # every tracked text file
 *   node scripts/scan-secrets.js <path...>   # explicit paths
 * Exit 1 and print `path:line:ruleId` (never the matched value) if anything
 * is found; exit 0 otherwise.
 */

"use strict";

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/** @typedef {{ id: string, description: string, pattern: RegExp }} SecretRule */

/**
 * The placeholder denylist is what makes the generic high-entropy rule
 * usable on a repo full of dev fixtures (docker-compose defaults, .env.example,
 * test tokens) instead of firing on every one of them — see
 * docs/security/README.md and the "does not flag placeholders" spec.
 */
const PLACEHOLDER_DENYLIST = [
  "example",
  "test",
  "dummy",
  "fake",
  "placeholder",
  "changeme",
  "your-",
  "xxx",
  "local",
  "dev-secret",
];

/**
 * Lines carrying this pragma (anywhere on the line) are never flagged by
 * any rule — the documented escape hatch for legitimate fixtures. See
 * docs/security/README.md for the recorded pragma sites.
 */
const PRAGMA = "pragma: allowlist secret";

/** @type {SecretRule[]} */
const SECRET_RULES = [
  {
    id: "private-key-block",
    description: "PEM-encoded private key header",
    pattern: /-----BEGIN[ A-Z0-9]*PRIVATE KEY-----/,
  },
  {
    id: "aws-access-key-id",
    description: "AWS access key id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: "anthropic-api-key",
    description: "Anthropic API key (sk-ant-...)",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    id: "generic-sk-api-key",
    description: "Generic sk-... API key (32+ chars)",
    pattern: /\bsk-[A-Za-z0-9]{32,}\b/,
  },
  {
    id: "google-api-key",
    description: "Google API key (AIza...)",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    id: "github-token",
    description: "GitHub personal access / app token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  },
  {
    id: "slack-token",
    description: "Slack token (xox...)",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    id: "sentry-dsn-with-secret",
    description: "Legacy Sentry DSN carrying a public:secret key pair",
    pattern: /https?:\/\/[a-f0-9]{16,}:[a-f0-9]{16,}@[^/\s"']+\/\d+/i,
  },
  {
    id: "generic-high-entropy-assignment",
    description:
      "Quoted assignment to a key matching api[_-]?key|secret|password|passwd|token|credential " +
      "whose value is >=20 chars, mixes letters+digits, and is not a placeholder",
    // The actual placeholder/entropy filtering happens in `scanText` (a pure
    // regex can't express "not a known placeholder" cleanly) — this pattern
    // only locates the candidate key=value/key:value assignment.
    pattern:
      /(?:api[_-]?key|secret|password|passwd|token|credential)\s*[:=]\s*["']([^"']{20,})["']/i,
  },
];

/**
 * Expo push tokens (`ExponentPushToken[...]`/`ExpoPushToken[...]`) are a
 * publicly-documented, non-secret device-registration identifier — this
 * exact shape is what `expoPushToken` DTOs validate against elsewhere in
 * this repo (`apps/api/src/devices`). They match the generic rule's key
 * pattern (`...token...`) and are long/mixed enough to look "high entropy",
 * but they carry no secret: excluding this recognized, structurally-typed
 * format is precision tuning of the rule, not a repo-specific denylist word.
 */
const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;

/**
 * @param {string} value
 * @returns {boolean} true if the value looks like a real secret (not a
 * placeholder / low-entropy dev fixture).
 */
function looksLikeRealSecret(value) {
  const lower = value.toLowerCase();
  if (PLACEHOLDER_DENYLIST.some((word) => lower.includes(word))) {
    return false;
  }
  if (EXPO_PUSH_TOKEN_PATTERN.test(value)) {
    return false;
  }
  const hasDigit = /[0-9]/.test(value);
  const hasLetter = /[A-Za-z]/.test(value);
  return hasDigit && hasLetter;
}

/**
 * @param {string} text
 * @returns {{ line: number, ruleId: string }[]}
 */
function scanText(text) {
  /** @type {{ line: number, ruleId: string }[]} */
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes(PRAGMA)) {
      continue;
    }
    for (const rule of SECRET_RULES) {
      if (rule.id === "generic-high-entropy-assignment") {
        const match = rule.pattern.exec(line);
        if (match && looksLikeRealSecret(match[1])) {
          findings.push({ line: i + 1, ruleId: rule.id });
        }
        continue;
      }
      if (rule.pattern.test(line)) {
        findings.push({ line: i + 1, ruleId: rule.id });
      }
    }
  }
  return findings;
}

const SKIP_NAME_PATTERNS = [/^pnpm-lock\.yaml$/];
const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  "dist",
  ".next",
  "coverage",
  ".expo",
  ".git",
]);
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".pdf",
  ".zip",
]);

/**
 * @param {string} filePath repo-relative or absolute path
 * @returns {boolean}
 */
function shouldSkip(filePath) {
  const segments = filePath.split(path.sep);
  if (segments.some((segment) => SKIP_DIR_SEGMENTS.has(segment))) {
    return true;
  }
  const base = path.basename(filePath);
  if (SKIP_NAME_PATTERNS.some((pattern) => pattern.test(base))) {
    return true;
  }
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * @param {string[]} filePaths
 * @param {string} [cwd]
 * @returns {{ path: string, line: number, ruleId: string }[]}
 */
function scanFiles(filePaths, cwd) {
  /** @type {{ path: string, line: number, ruleId: string }[]} */
  const findings = [];
  for (const filePath of filePaths) {
    if (shouldSkip(filePath)) {
      continue;
    }
    const absolute = cwd ? path.join(cwd, filePath) : filePath;
    let buffer;
    try {
      buffer = fs.readFileSync(absolute);
    } catch {
      continue;
    }
    // Skip binary content not already excluded by extension (a NUL byte in
    // the first slice is a reliable, dependency-free binary guard).
    if (buffer.subarray(0, 8000).includes(0)) {
      continue;
    }
    const text = buffer.toString("utf8");
    for (const finding of scanText(text)) {
      findings.push({ path: filePath, ...finding });
    }
  }
  return findings;
}

function listStagedFiles(cwd) {
  const out = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
    { cwd, encoding: "utf8" },
  );
  return out.split("\n").filter(Boolean);
}

function listTrackedFiles(cwd) {
  const out = execFileSync("git", ["ls-files"], { cwd, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  /** @type {string[]} */
  let files;
  if (args.includes("--staged")) {
    files = listStagedFiles(cwd);
  } else if (args.includes("--tracked")) {
    files = listTrackedFiles(cwd);
  } else if (args.length > 0) {
    files = args;
  } else {
    files = listTrackedFiles(cwd);
  }

  const findings = scanFiles(files, cwd);
  if (findings.length > 0) {
    for (const finding of findings) {
      // Never print the matched value — only path:line:ruleId.
      console.error(`${finding.path}:${finding.line}:${finding.ruleId}`);
    }
    process.exitCode = 1;
    return;
  }
  process.exitCode = 0;
}

module.exports = { SECRET_RULES, scanText, scanFiles };

if (require.main === module) {
  main();
}
