# Backlog — v1.1 candidates (seeded 2026-08-02, at milestone M11)

This document is the T112 deliverable: a scored engineering backlog for v1.1
planning, produced at the end of the loop's 119-card build. It is a synthesis
of accumulated deferrals, checker findings and `PRODUCT_SPEC §10` — read §1
before trusting any score in §3.

## 1. Honesty: what seeded this backlog — and what did not

The task card asks to synthesize "beta feedback + metrics" into this
backlog. Both inputs are checked here and found empty:

| Claimed input | Actual state (verified) | Evidence |
|---|---|---|
| Beta feedback | Zero reports. T104 shipped the `FeedbackReport` table + mobile modal, but no beta build has ever been distributed (T101 produced no signed store artifact — pinned by a CI-honesty assertion), and there is no reader UI. | `loop/journal.md:1455`, `:1461` ("no admin reader UI yet (Postgres/MinIO only)"), `:1381` |
| Product metrics | Zero events. PostHog/Sentry are unprovisioned in this environment; T103's dashboards were only `--dry-run`-provisioned; T103 AC2 ("staging events visible in funnel") is still `[FOUNDER-5]`, unfulfilled. | `loop/journal.md:1439`, `:1445` |
| Store/CI signals | No GitHub Actions run has ever been observed from this environment; `EXPO_TOKEN` unset, so no OTA publish has occurred. | `loop/journal.md:1321`, `:1598` |

No user feedback and no product metrics exist yet; every item below comes
from engineering deferrals, checker findings, or PRODUCT_SPEC §10.

No user quotes, percentages, adoption numbers or retention numbers are
invented anywhere in this document — every claim below is engineering
judgment traced to a real, cited artifact, never to a user or to telemetry
that does not exist yet.

Re-score this backlog when real beta data arrives (see §7).

## 2. Scoring rubric (ICE) — engineering judgment, not data

- Impact, Confidence, Ease each an integer 1–10 (10 = highest impact / most
  certain / easiest). ICE = Impact x Confidence x Ease (range 1–1000).
- "Confidence" = confidence that the item is worth doing AND that the
  Impact estimate holds — NOT confidence that we can build it.
- **Rule C: any row whose value depends on user behaviour we have not
  observed scores Confidence <= 5.** All ten PRODUCT_SPEC §10 product rows
  are in that class by construction (they are, definitionally, entire new
  product surfaces with zero usage evidence).
- Ordering: table sorted by ICE descending, ties broken by ID ascending.
  Deterministic and re-derivable from the rows below.
- These scores are one engineer's judgment recorded on 2026-08-02; they are
  a starting point for founder discussion, not a measurement.

## 3. Scored backlog (32 items)

| ID | Title | Category | Source | I | C | E | ICE | Notes |
|---|---|---|---|---|---|---|---|---|
| B-04 | Invite-accept destroys the joiner's own `Subscription` row (T026 household-delete + T072 cascade) | Correctness / billing | `loop/journal.md:1636` (T108 F5) | 9 | 8 | 5 | 360 | Pre-existing since T026/T072; a paying user who accepts an invite loses their own mirrored subscription row. Named by the checker as needing its own card. |
| B-06 | Locale-flip prerequisites F4 + F7 | i18n | `loop/journal.md:1664` | 6 | 7 | 6 | 252 | `getStrings` is an exported serve-gate bypass returning `unknown`; `formatWeight` defaults to `"en"` while `formatCheckDate` uses `getActiveLocale`, so the weight surface would silently stay English. Both must land before any `reviewed:true`. |
| B-02 | FLAKE-2: `account-deletion.e2e` Prisma-engine/BullMQ teardown ordering | Reliability | `loop/journal.md:1313`, `:1622` | 6 | 8 | 5 | 240 | Engine-not-yet-connected, post-teardown BullMQ; 2/2 reproducible under forced full runs, clean in isolation. Checker explicitly asked for its own card. |
| B-21 | Observability instrumentation gaps | Ops / analytics | `loop/journal.md:1439` (G1–G3: registry has only 3 events), `:1441` (F2 dashboard payload envelopes may drift from live PostHog/Sentry schemas; F3/F4 weak env-var guards) | 8 | 7 | 4 | 224 | Directly limits the "metrics" input this very backlog lacks — a self-referential first-class item; also covers weak env-var guards on the provisioning CLIs. |
| B-01 | FLAKE-1: `devices.e2e` ECONNRESET flake | Reliability | `loop/journal.md:1313` | 6 | 7 | 5 | 210 | Agent/keep-alive issue; batching does not apply. Expect real CI red about once every two to three runs until fixed; the correct response is fixing the spec, never retries. |
| B-05 | Referral grant issuance durability — outbox + reconciliation | Correctness / billing | `loop/journal.md:1634`, `:1636`; `docs/referral-grants.md §7` | 7 | 7 | 4 | 196 | Post-commit issuance is best-effort/at-most-once: crash, timeout, swallowed error, deadlock or second-recipient rollback after a committed join silently loses both grants forever (`usedAt` consumed, so a re-POST returns 404). Founder decision on funding it is in §4. |
| B-15 | Real F3 food-safety surface in chat (quick prompts only prefill today) | Product / F3 | `loop/journal.md:1146` | 6 | 6 | 5 | 180 | Named "for a future card" at T083; quick prompts prefill the composer today rather than routing to a dedicated food-safety flow. |
| B-19 | Test-debt sweep: bare-passthrough provider-mock refactor + accepted LOW pins | Test debt | `loop/journal.md:1622` (T107 F7, 4th recurrence — explicitly flagged as an "M11 planning refactor candidate"), `:1459` (T104 LOWs), `:1541` (Android hardware-back unpinned) | 6 | 7 | 4 | 168 | Mock-blindness is the class that produced T107's two round-1 HIGHs; the bare-passthrough provider-mock pattern has now recurred a fourth time. The refactor is the systemic fix. |
| B-20 | Docs & branding string debt | Docs | `loop/journal.md:1369`/`:1600` (stale `0.0.0` example at `docs/store-privacy.md:250`), `:1339` (chat 402 hardcodes the display name — T097 debt, REBRAND LOW-4; README CI badge still points at the pre-rename repo URL) | 3 | 7 | 8 | 168 | The chat 402 string and the stale `0.0.0` release example are straightforward fixes. The README CI badge half is `[founder-gated]` — it stays correct until the founder renames the GitHub repo. |
| B-09 | Multilingual unsafe-output detector (T038 detector is English-only) | Safety tooling | `loop/journal.md:1666` | 8 | 6 | 3 | 144 | Blocks B-07: the red-team detector cannot screen non-English model output today. Hard prerequisite of any locale flip — Ease scored honestly, not optimistically. |
| B-18 | Admin dashboard follow-ons: real MRR needs a billing-event ledger; fold in the client-versions OTA-adoption panel | Ops / billing | `loop/plans/T111.plan.md §7 R1`, `§8 items 5–6`; `loop/journal.md:1676` | 6 | 6 | 4 | 144 | `ProcessedWebhookEvent` stores no amounts, so the dashboard ships labelled event counts; a revenue figure requires a write-path ledger on the T072 webhook handler. The client-versions OTA-adoption panel was deliberately excluded from T111 and could fold in here. |
| B-07 | Per-locale human-review pipeline before any `reviewed:true` flip | i18n / process | `loop/journal.md:1666`; `docs/I18N.md` | 7 | 6 | 3 | 126 | es/pt-BR/hi are machine-translated and hard-gated; each needs native-translator and `[VET]` review of safety-adjacent copy before serving. |
| B-14 | Editorial + `[VET]` review and publish path for the 45 drafted breed guides | Content | `loop/journal.md:1471`, `:1475` | 7 | 6 | 3 | 126 | 50 guides exist, only 5 are `reviewed`/published; 45 drafts are listed by slug and must not be published unreviewed. |
| B-08 | `ar` RTL completion — NativeWind logical-property migration + `forceRTL` reload flow | i18n | `loop/journal.md:1666`; `docs/I18N.md` | 5 | 6 | 4 | 120 | Only an `ar-XB` pseudolocale smoke exists; no invented Arabic shipped. Inventory already written in `docs/I18N.md`. |
| B-22 | Expo SDK drift — 12 packages behind (`expo-doctor`) | Maintenance | `loop/journal.md:1363` | 4 | 6 | 5 | 120 | Pre-existing and deliberately untouched at T100; rides a binary release, so it should be batched with B-10. |
| P-09 | multi-language content | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 6 | 5 | 3 | 90 | SPEC-deferred v1 scope item; the i18n scaffold (T110) exists but full multi-language content delivery beyond the scaffold is out of scope for v1 by design. |
| B-13 | Per-row toxin source attribution (currently category-level, T035 R9) | Content / data | `loop/journal.md:1475`; `docs/qa/dataset-audit.md` | 4 | 5 | 4 | 80 | 233 toxins are attributed at category level; per-row provenance is the stronger claim a vet reviewer will want. Founder/vet decides category-vs-per-row (§4). |
| B-17 | `/v1/meta/client-versions` D5 freshness — per-launch reporting instead of last-seen-day bucketing | Ops | `loop/journal.md:1575`, `:1578` | 3 | 5 | 5 | 75 | `[founder-gated]` — rejection of D5 is the trigger for this card. The last-seen-day-bucketing limitation is honestly disclosed everywhere today. |
| P-08 | web app for consumers | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 6 | 4 | 3 | 72 | SPEC-deferred v1 scope item; the web app today is marketing/SEO only by design. |
| B-16 | `VetDisclaimer` dark-mode styling unfreeze | UI | `loop/journal.md:1263` | 2 | 5 | 7 | 70 | `[founder-gated]`, aesthetic only — the audit shows AAA compliance in both themes as-is, so this is a look-and-feel change to a §7-frozen component and must never weaken or make the disclaimer dismissible. |
| B-03 | Unattributed api-suite flake under forced full-parallel runs | Reliability | `loop/journal.md:1505` | 4 | 4 | 4 | 64 | Shape-consistent with FLAKE-2 but unconfirmed; recommended as a dedicated card rather than repeated re-run-green dismissals. |
| B-11 | Auto-screenshot attach on feedback — D2 | Product / feedback | `loop/journal.md:1457` | 3 | 4 | 5 | 60 | Not implemented; user-attached image is today's substitute. T104 is explicitly not full card fidelity until D1+D2 are decided. |
| B-12 | Store-screenshot caption pixel burn-in | Store assets | `loop/journal.md:1369` | 2 | 5 | 6 | 60 | Captions currently ship as `marketing-strings.ts` sidecars + `copy-blocks.md`, not burned into the PNGs. |
| P-10 | document/record OCR imports | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 5 | 4 | 3 | 60 | SPEC-deferred v1 scope item; no OCR or record-import pipeline exists today. |
| B-10 | Real shake-to-report (needs `expo-sensors` ⇒ native fingerprint change ⇒ new binary) — D1 | Product / feedback | `loop/journal.md:1457` | 4 | 4 | 3 | 48 | Currently a documented no-op seam (`shake-detector.ts`); adding the dep strands existing beta builds off-OTA, so it must ride a binary release. |
| P-07 | Android widgets/watch apps | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 4 | 4 | 3 | 48 | SPEC-deferred v1 scope item; no widget or wearable surface exists today. |
| P-04 | insurance upsells | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 5 | 3 | 3 | 45 | SPEC-deferred v1 scope item; no insurance-partner integration exists today. |
| P-01 | vet telehealth/marketplace | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 7 | 3 | 2 | 42 | SPEC-deferred v1 scope item; the product is guidance-only by design, never a booking/marketplace surface (PRODUCT_SPEC §5). |
| P-02 | exotic species | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 4 | 3 | 3 | 36 | SPEC-deferred v1 scope item; v1 species scope is dogs and cats only (PRODUCT_SPEC §1). |
| P-03 | wearable/IoT integrations | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 5 | 3 | 2 | 30 | SPEC-deferred v1 scope item; no wearable or IoT data path exists today. |
| P-06 | real-time voice AI | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 5 | 3 | 2 | 30 | SPEC-deferred v1 scope item; the chat surface is text-only today. |
| P-05 | social feed/community | Product deferral (SPEC §10) | `docs/PRODUCT_SPEC.md §10` | 4 | 2 | 2 | 16 | SPEC-deferred v1 scope item; lowest-confidence row here — a community surface raises new moderation and safety-copy-drift risk before any observed demand. |

## 4. Founder decisions & operational to-dos (NOT backlog items, NOT scored)

These are decisions or operational to-dos, not loop-executable engineering
work. They are not scored and are not part of the table in §3.

### Open decisions

- Referral issuance durability — accept best-effort for launch vs. fund the
  outbox card (`loop/journal.md:1634`, `docs/referral-grants.md §7`).
- D9 defer-vs-elapse for already-paying referral recipients.
- Leave/rejoin cycling cap sufficiency for referral grants.
- D1 shake-to-report + D2 auto-screenshot authorization (`loop/journal.md:1457`).
- D5 `/v1/meta/client-versions` freshness accept/reject (`loop/journal.md:1578`).
- `VetDisclaimer` dark-mode styling (`loop/journal.md:1263`).
- Category-level vs. per-row toxin source attribution (`loop/journal.md:1475`).
- Paywall A/B adopt-or-kill at 900/arm — the loop never flips `PAYWALL_VARIANT`
  (`loop/journal.md:1620`).
- Privacy counsel review of the feedback-report export scope (`loop/journal.md:1461`).

### Legal / naming

- Instruct qualified trademark counsel — classes 9/35/42, explicitly not 44
  (F3, `docs/store-listing.md §6`).
- Algeria INAPI still owed if it is a launch market (F1, `docs/store-listing.md §6`).
- Approve substitutions S1/S2 (F1/F2, `docs/store-listing.md §6`).
- Final name + bundle-id confirmation.
- Pre-submission re-verification of the §7 evidence queries (F6,
  `docs/store-listing.md §6`).
- Anchors: `docs/store-listing.md §6`, `loop/journal.md:1405`, `:1423`.

### `[VET]` verification queues

- 5 hotline rows to verify against operator listings.
- 100 toxin verdict rows (3 priority queues).
- 45 draft breed guides before any wider publish.
- Anchors: `docs/qa/dataset-audit.md §5`, `loop/journal.md:1475`. Every cell
  is `UNVERIFIED` today and no code path can emit `VERIFIED`.

### Ops / secrets / infra

- EAS project re-create → new `projectId` → `updates.url`.
- Beta binary rebuilds (fingerprint changed at T113, again at T109's
  `expo-store-review`).
- Provision `EXPO_TOKEN`, `PROD_API_URL`, `ADMIN_API_TOKEN`,
  `ADMIN_ALLOWED_EMAILS`, `ADMIN_DASHBOARD_PASSWORD`, `APP_VERSION`,
  `CRITICAL_OTA_VERSION`, `MIN/RECOMMENDED_APP_VERSION_{IOS,ANDROID}`.
- Branch protection: mark the 7 required status checks on main (T118).
- Kill-switch fire drill (`docs/release-runbook.md §9` item 14).
- Staging Sentry release evidence (T117 §9.1 recipe).
- `bombaypetcompany.app` registration + `staging-api` DNS.
- 8-shot screenshot capture via `/emulator-test`.
- On-device VoiceOver/TalkBack pass.
- GitHub repo rename + README badge.
- Anchors: `docs/release-runbook.md §9`, `loop/checkpoint-C3-notes.md`,
  `loop/journal.md:1600`, `:1592`, `:1682`.

C3 approval unblocked the loop; it did not retroactively verify any of
these (`loop/journal.md:1608`).

## 5. Draft: proposed next two phases — FOR FOUNDER REVIEW, NOT COMMITTED

DRAFT — for founder review, not committed. This section does not modify
docs/PHASES.md and no task here is scheduled.

### Draft Phase 12 — Reliability & correctness hardening

1. `B-04` — Invite-accept destroys the joiner's own `Subscription` row
2. `B-02` — FLAKE-2: `account-deletion.e2e` Prisma-engine/BullMQ teardown ordering
3. `B-01` — FLAKE-1: `devices.e2e` ECONNRESET flake
4. `B-05` — Referral grant issuance durability — outbox + reconciliation
5. `B-21` — Observability instrumentation gaps
6. `B-19` — Test-debt sweep: bare-passthrough provider-mock refactor
7. `B-03` — Unattributed api-suite flake under forced full-parallel runs

### Draft Phase 13 — Content, i18n & product depth

1. `B-06` — Locale-flip prerequisites F4 + F7
2. `B-09` — Multilingual unsafe-output detector
3. `B-07` — Per-locale human-review pipeline before any `reviewed:true` flip
4. `B-08` — `ar` RTL completion
5. `B-14` — Editorial + `[VET]` review and publish path for the 45 drafted breed guides
6. `B-15` — Real F3 food-safety surface in chat
7. `B-13` — Per-row toxin source attribution

**Sequencing constraints:** B-09 gates B-07 gates any locale flip; B-10/B-22
ride the same binary release; B-05 precedes any referral marketing; B-21
precedes any metrics-driven re-scoring.

## 6. Safety guardrail on every item

No backlog item may weaken a Safety Policy surface named in
PRODUCT_SPEC §5 / CLAUDE.md §7: the non-dismissible <VetDisclaimer/>, the
deterministic emergency interstitial and its region-aware hotlines, the
fail-upward uncertainty rule, and the medication-dosing prohibition. B-16 in
particular restyles the disclaimer; it may never make it dismissible,
conditional, or lower-contrast.

Note that B-09 exists precisely because the safety detector cannot yet
screen non-English output.

## 7. Re-scoring trigger

Re-score every row once (a) a beta build reaches real users, (b) PostHog
receives events (B-21), and (c) the FeedbackReport table is non-empty with a
reader surface. Until all three hold, Confidence values in this file are
priors, not evidence.
