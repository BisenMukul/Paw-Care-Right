# Security pass (T096)

This directory documents the security controls added by T096: the
dependency-audit CI gate, the secrets scanner, and the mobile on-device
storage audit. See also `docs/adr/0001-mobile-tls-certificate-pinning.md`
for the (deferred) certificate-pinning decision.

## 1. Dependency audit gate

CI's `security` job (`.github/workflows/ci.yml`) runs `pnpm audit
--audit-level high` unconditionally on every push/PR. It fails the build on
any **high** or **critical** advisory that isn't explicitly, justifiably
suppressed. It is never gated on a secret and never skippable via `if:`.

Run it locally exactly as CI does:

```bash
pnpm audit --audit-level high
```

### Response playbook (in order — allowlisting is last resort)

1. **Upgrade the direct dependency** to the patched version.
2. **Transitive with a fixed version, but the direct/parent package has no
   newer release that adopts it** — prefer bumping the parent first; only
   reach for `pnpm.overrides` in root `package.json` if the parent is
   already at its latest release and still pins the vulnerable transitive.
   An override is real remediation (not a suppression) and must still be
   verified: re-run the full gate suite (`typecheck`/`lint`/`test`/`build`)
   after applying it, since forcing a version a parent didn't test against
   is itself a risk to weigh.
3. **No fix exists, or the only fix breaks the app** (verify this
   empirically, not by assumption) — allowlist it:
   - Add the GHSA id to root `package.json` → `pnpm.auditConfig.ignoreGhsas`.
   - Add a matching entry to `docs/security/audit-allowlist.json` with a
     concrete `reason`, a concrete `reachability` analysis (does our code
     actually reach the vulnerable path?), and an `expiresOn` no more than
     90 days out. "Low severity in practice" with no argument is not a
     justification.
   - The two files are kept in sync by
     `apps/api/test/security-ci-gate.spec.ts`'s `validateAuditAllowlist`
     checks (in both directions: an ignored GHSA with no allowlist entry,
     or an allowlist entry that isn't actually suppressing anything, are
     both violations), and the entry's `expiresOn` forces a re-review
     before it's allowed to age past 90 days.
4. **Never** clear the gate by lowering `--audit-level`.

`pnpm.auditConfig.ignoreGhsas` is pnpm's own native suppression mechanism
(verified working on the pinned `pnpm@10.34.3`); the CI command really is
the card's literal `pnpm audit`, and the allowlist file supplies what pnpm
itself has no field for (reason/reachability/owner/expiry).

## 2. Secrets scanner (`scripts/scan-secrets.js`)

A small, dependency-free (CommonJS, Node 22) scanner — deliberately not
`gitleaks`/`trufflehog` (CLAUDE.md §2 rule 7: no new dependency, and a
secrets scanner is exactly the wrong place to add supply-chain surface for
a repo with one language family and a known, small set of credential
shapes). Its recall is smaller than a mature tool with hundreds of rules;
the rule set below is a documented starting point, extended whenever a new
credential type enters the stack.

Rules: PEM private-key headers, AWS access key ids, Anthropic (`sk-ant-`)
and generic `sk-...` keys, Google (`AIza...`) keys, GitHub tokens
(`gh[pousr]_...`), Slack tokens (`xox[baprs]-...`), a legacy Sentry DSN
carrying a `public:secret` pair, and one **generic** rule: a quoted
assignment to a key matching
`api[_-]?key|secret|password|passwd|token|credential` whose value is 20+
chars, mixes letters and digits, and isn't a known placeholder
(`example`/`test`/`dummy`/`fake`/`placeholder`/`changeme`/`your-`/`xxx`/
`local`/`dev-secret`). The placeholder list plus a couple of precision
exclusions (see below) are what make the generic rule usable on a repo full
of dev/test fixtures instead of firing on every one of them.

Findings never include the matched value — only `path:line:ruleId` — so a
CI log never becomes a secondary leak of whatever it found.

**Precision exclusion:** Expo push tokens
(`Expo(nent)?PushToken[...]`) are excluded from the generic rule. They
match the key-name pattern (`expoPushToken`) and look high-entropy, but
they are a publicly-documented, non-secret device-registration identifier
(the same shape `apps/api/src/devices` DTOs validate against) — excluding
this one recognized, structurally-typed format is precision tuning of the
rule, not a repo-specific denylist hack, and it was verified empirically
against the real tracked tree (two false positives in
`apps/api/src/devices/*.spec.ts` before this exclusion, zero after).

Run it locally:

```bash
node scripts/scan-secrets.js --tracked   # every tracked file
node scripts/scan-secrets.js --staged    # git diff --cached, ACM files only
node scripts/scan-secrets.js path/to/file.ts another/file.ts
```

CI runs `node scripts/scan-secrets.js --tracked` unconditionally in the
same `security` job as the audit gate.

### Legitimate-fixture pragma

Skip a specific line with `pragma: allowlist secret` anywhere on that line.
No pragma sites exist in the tracked tree today (the real-tree scan in
`apps/api/test/secret-scan.spec.ts` is a negative control — it stays green
without needing any).

## 3. Mobile on-device storage audit

See `docs/security/mobile-storage-audit.md` for the full inventory:
SecureStore (OS keychain) is the only credential store, reached through
exactly one file; MMKV is **not encrypted** in this app, and every
persisted MMKV store is enumerated and checked for credential-shaped keys.

## 4. Certificate pinning

Deferred, not implemented — see
`docs/adr/0001-mobile-tls-certificate-pinning.md` for the full reasoning
and the concrete triggers that would prompt revisiting it.
