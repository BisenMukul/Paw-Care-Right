# paywall-ab.md — Paywall copy A/B experiment (T107)

This document is the single write-up for the paywall copy/trial-framing
experiment activated by T107. It names the hypothesis, the arms, the
assignment/exposure wiring, the success metric and its attribution chain,
the minimum sample and no-peeking rule, the stop conditions and kill switch,
the founder-only staging steps, and an honest statement of what was actually
executed in this environment. The drift guard
(`packages/analytics/src/experiments/paywall-ab-doc.spec.ts`) pins the
section order and cross-checks several claims below against the code they
describe.

---

## 1. Hypothesis

Paywall variant B's copy (a slightly more benefit-forward headline/subcopy,
plus a differently-framed trial call to action) increases the rate at which
users who view the paywall start a free trial, compared to variant A
(control, today's shipped copy). Both arms describe the identical product
(same plans, same 7-day trial length, same prices from the RevenueCat
offering) — only wording differs.

---

## 2. Arms (what differs)

Two arms, `PAYWALL_EXPERIMENT_ARMS` (`packages/analytics/src/experiments/paywall-ab.ts`):

| Arm | Role | Differs from the other arm in |
|---|---|---|
| `A` | Control — byte-identical to the pre-T107 shipped copy | — |
| `B` | Test | `headline`, `subcopy`, `trialCta`, `trialCtaWithPrice` |

All four differing string keys live under `strings.paywall.variants.{A,B}`
(`apps/mobile/src/strings.ts`). Trial *length* (7 days) is identical and
factual in both arms — matching the actual store product — never a
discount/urgency claim. CLAUDE.md §7 rules 1-2 apply to every arm; enforced
by `apps/mobile/__tests__/strings-detector-lint.test.ts` and
`apps/mobile/__tests__/paywall-snapshot.test.tsx`'s own forbidden-token
guard, both of which scan every arm automatically.

---

## 3. Assignment and exposure

Bucketing itself is not new (T079): `assignPaywallVariant`
(`apps/api/src/remote-config/variant-assignment.ts`) deterministically hashes
`userId` (FNV-1a) into `A`/`B`, gated by the `PAYWALL_VARIANT` env var
(`apps/api/src/config/env.schema.ts`, `z.enum(["A","B","AUTO"]).default("AUTO")`)
— `AUTO` is the live 50/50 split; setting it to `A` forces every user into
control. T107 adds the two events that let PostHog *measure* that existing
split — it does not re-implement assignment.

Two distinct events, `paywall_experiment_assigned` and
`paywall_experiment_exposed` (both declared in
`packages/analytics/src/events.ts`, keyed on the experiment id
`PAYWALL_EXPERIMENT_KEY = "paywall_copy_ab"`):

- **`paywall_experiment_assigned`** — enrolment. Fired **once per signed-in
  app session**, from `usePaywallExperimentAssignment()`
  (`apps/mobile/src/experiments/use-paywall-experiment-assignment.ts`),
  mounted once at the root (`apps/mobile/app/_layout.tsx`'s `AppRoot`).
- **`paywall_experiment_exposed`** — the metric's denominator: the user
  actually saw an arm. Fired **once per rendered variant** on paywall mount
  (`apps/mobile/app/paywall.tsx`'s exposure effect).

**Fix-round correction (checker findings F1/F2, both HIGH — the original
text here read "the first time the resolved variant is observed," which was
inaccurate and is corrected below):** neither event fires against the
*anonymous* answer to `/v1/config`. Every cold start's **first** `/v1/config`
request races auth restore and is unauthenticated (`getAuthToken()` is
`null` until `restore()`/`refreshSession()` completes); the server's
`OptionalJwtAuthGuard` + `assignPaywallVariant(undefined, "AUTO")` answers
**"A" for every user** on that request (`variant-assignment.ts`), and the
shared `["app-config"]` query's offline-safe `initialData` fallback is
`"A"` too — neither is a real per-user assignment. Both emitters now go
through `useResolvedPaywallVariant()`
(`apps/mobile/src/experiments/use-resolved-paywall-variant.ts`), which waits
for `useAuthStore`'s `status` to become `"signedIn"`, explicitly re-fetches
`["app-config"]` at that moment (now carrying the real access token), and
only exposes `resolved: true` once that specific fetch settles.
`captureAssignmentOnce`/the exposure effect **never emit while `resolved`
is `false`** — the paywall screen's own on-screen copy is unaffected and
still renders immediately from the fail-open `config?.variant ?? "A"` (no
new loading state is added to the UI, only to the analytics emission).

**Residual, disclosed caveat:** if the authenticated re-fetch itself fails
(offline, server error) the hook resolves anyway using whatever that failed
fetch's cached/fallback data was, rather than blocking forever — a
lower-confidence report is judged better than an experiment that silently
never measures users who are offline right when they sign in. This is a
rare, disclosed edge case, not the deterministic every-cold-start bug the
fix-round corrected. A genuine mid-run `PAYWALL_VARIANT` env flip on an
ALREADY-signed-in, already-resolved session is still picked up reactively
(the shared query cache updates for every observer), producing a new
assignment/exposure rather than silently hiding the change — see §6 stop
condition 5 for why that voids a run.

---

## 4. Success metric — trial_start rate

The metric is **`trial_start` rate per `paywall_experiment_exposed` user,
per arm** (SPEC §8 target ≥ 8%, `docs/PRODUCT_SPEC.md:167`). `trial_start` is
emitted server-side off the RevenueCat webhook
(`apps/api/src/billing/rc-webhook.service.ts`), unchanged by this card, and
**deliberately does not carry a `variant` property.**

Attribution is person-level, not event-level: the mobile purchase flow calls
`logIn` (`apps/mobile/src/billing/purchases.ts`) to identify the RevenueCat
`appUserID` as the backend `User.id`; the same `User.id` is the PostHog
`distinct_id` used by the client's `paywall_experiment_exposed` emission and
by the server's `trial_start` emission
(`captureForUser`, `apps/api/src/analytics/analytics.service.ts`). Because
both events share the same `distinct_id`, PostHog itself can join a
`trial_start` conversion back to the arm the same person was exposed to —
stamping the arm onto `trial_start` directly would risk re-deriving the
variant from a potentially-changed `PAYWALL_VARIANT` at conversion time,
silently mis-attributing any conversion that happens after a mid-run flip;
person-level join is immune to that.

---

## 5. Minimum sample and the no-peeking guard

`PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM = 900` exposed users per arm
(`packages/analytics/src/experiments/paywall-ab.ts`), from the standard
80%-power / α = 0.05 two-sided approximation
`n = 16 · p̄(1 − p̄) / δ²` with baseline `p = 0.08` (SPEC §8), target `0.12`,
`p̄ = 0.10`, `δ = 0.04`: `16 × 0.09 / 0.0016 = 900`.

This is a **documented, no-peek threshold — not code-enforced.** Nothing in
this repository can read PostHog counts (no read API, no keys configured
anywhere in this codebase); `packages/analytics/src/experiments/paywall-ab-doc.spec.ts`
only proves that this document and the committed constant agree with each
other and with the formula above, never that any real PostHog project has
reached the threshold. **Do not make a ship/kill decision before both arms
have independently reached 900 exposed users.**

---

## 6. Stop conditions and kill switch

1. **No peeking.** No adopt/kill decision before **both** arms independently
   reach the `PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM` (900) exposed-user
   threshold in §5.
2. **Max run length: 28 days.** If neither arm has reached the minimum
   sample by then, the result is inconclusive — keep `A` (control) running
   and do not adopt `B`.
3. **Decision rule at min sample.** Once both arms reach 900 exposed users,
   adopt the winning arm by setting the api's `PAYWALL_VARIANT` env var to
   that letter; otherwise (no significant difference, or B underperforms)
   set `PAYWALL_VARIANT=A` explicitly to keep the control experience.
   **Fix-round correction (F5):** do NOT leave `PAYWALL_VARIANT=AUTO` as the
   "keep A" outcome — under `AUTO`, `assignPaywallVariant` keeps routing
   ~50% of users to B indefinitely, which is not "keeping A as the shipped
   experience" and contradicts stop condition 2 above. `AUTO` is only the
   correct setting *while the experiment is actively running*; a decision
   to not adopt `B` must set `PAYWALL_VARIANT=A` explicitly.
4. **Immediate safety/quality stop — no sample threshold required.** Any of:
   a CLAUDE.md §5/§7 safety concern surfacing in either arm's copy, a store
   review objection to an arm's wording, a paywall crash/error-rate
   regression, or a billing anomaly correlated with an arm → set
   `PAYWALL_VARIANT=A` (control) immediately, or disable the paywall
   entirely via `features.paywall=false` (T106), and log the stop in
   `loop/journal.md` at once. This stop condition overrides 1-3 entirely.
5. **Changing `PAYWALL_VARIANT` mid-run for any other reason voids the
   run.** A run whose `PAYWALL_VARIANT` setting changed for a reason other
   than stop condition 4 must restart its sample count from zero — the
   mid-session re-assignment/re-exposure behaviour (§3) is honest about a
   flip happening, but the accumulated sample before the flip cannot be
   treated as clean data for the new split.

**Kill switch:** setting the api's `PAYWALL_VARIANT` env var to `"A"` forces
every user into the control arm immediately (no client release needed); the
existing `features.paywall` flag (T106) can also disable the paywall surface
entirely.

---

## 7. `[FOUNDER]` PostHog wiring + staging verification

1. **Env:** confirm `PAYWALL_VARIANT=AUTO` (the live 50/50 bucketing) on the
   staging and production api deployments for the duration of the run;
   record the value in `loop/journal.md` at experiment start.
2. **PostHog console — analysis path (fix-round correction, F3):** bucketing
   here is entirely OUR OWN server-side FNV-1a hash
   (`assignPaywallVariant`, `apps/api/src/remote-config/variant-assignment.ts`),
   independent of PostHog's own feature-flag hashing — this codebase never
   calls `posthog.getFeatureFlag`/`isFeatureEnabled` and never sends a
   `$feature/paywall_copy_ab` property, so a PostHog "Experiment" created on
   flag key `paywall_copy_ab` would evaluate its OWN (irrelevant) flag
   assignment, not the arm the user actually saw. The **primary, working
   analysis path** is a plain PostHog Insight: a trend or funnel
   (`paywall_experiment_exposed` → `trial_start`) broken down by the
   `variant` property carried on `paywall_experiment_exposed` itself — this
   is analysable today with no further code changes. Creating a PostHog
   "Experiment" object on feature-flag key `paywall_copy_ab` is OPTIONAL and
   must be understood as UI sugar only (e.g. for its results-summary
   layout) — never as the bucketing mechanism, and never trusted to report
   correct variant counts on its own.
3. **Staging verification (AC1 evidence):** using two staging accounts that
   deterministically bucket to different arms, open the paywall on each and
   confirm both `paywall_experiment_assigned` and `paywall_experiment_exposed`
   appear in PostHog's Live Events view, each carrying
   `experiment: "paywall_copy_ab"` and the expected `variant`. Screenshot the
   result into `loop/journal.md`.
4. **Decision authority:** the adopt/kill decision at minimum sample (§5/§6)
   — and the immediate safety stop (§6.4) — belongs to the founder. The
   build loop must never flip `PAYWALL_VARIANT` on its own.
5. **Store/legal:** if variant B's trial framing is ever reused on a store
   listing screenshot or marketing surface, re-check `docs/store-listing.md`
   — out of scope for this card.

---

## 8. Honest statement — what was actually executed here

<!-- BEGIN:honesty -->
**No PostHog API call was executed in this environment.** This environment
has no PostHog project, key, or read API available to it.

**Fix-round note:** a checker review found that the first committed version
of this card's emitters deterministically dropped `paywall_experiment_assigned`
for arm-A/warm-cache users and could report the anonymous cold-start
fallback variant as if it were a real assignment/exposure (findings F1 and
F2, both HIGH — see §3's corrected text above for the mechanism). Both were
fixed by gating emission on `useResolvedPaywallVariant()`'s `resolved` flag
(an authenticated `/v1/config` re-fetch triggered on the sign-in
transition). The PostHog analysis recipe (§7.2) and the stop-conditions
decision rule (§6.3) were also corrected (F3, F5) in the same pass.

What the executor-provable tests DO prove:
`apps/mobile/__tests__/paywall-experiment-events.test.tsx` proves, against
mocked flows (signed-in from the start), that `paywall_experiment_assigned`
fires once per session with the resolved variant and correctly re-fires
only on a genuine variant change once resolved; that
`paywall_experiment_exposed` fires once per rendered variant on paywall
mount, does not double-fire on a same-variant re-render, and coexists
correctly with the pre-existing `paywall_view` mount-once emission; and
that neither event (nor any other capture) fires when nobody is signed in.
`apps/mobile/__tests__/paywall-experiment-auth-resolution.test.tsx`
additionally proves, using the REAL `useAuthStore` (including its real
async `restore()` flow), the REAL `usePaywallConfig`/`fetchAppConfig`
chain, and a real `QueryClientProvider` (only the network boundary and the
MMKV cache are stubbed) — the specific regression the checker's review
targeted: a cold start with no stored session never emits either event even
though the anonymous config answers "A"; a session that resolves to
signed-in emits assignment exactly once, carrying the AUTHENTICATED
variant, never the anonymous fallback; and the paywall's exposure event
does not double-fire across the anonymous-then-authenticated flip.
`packages/analytics/src/experiments/paywall-ab-doc.spec.ts` and
`packages/analytics/src/store-privacy-doc.spec.ts` prove that this
document, the committed experiment constants, and the typed event registry
all agree with each other.

What these tests do NOT prove: that PostHog actually receives, ingests, or
correctly attributes either event in a real project; that the Insight/
Experiment described in §7 has actually been created in any PostHog
console; that the minimum-sample rule in §5 is enforced by anything other
than this document and the humans who read it; or that the rarer,
disclosed residual case in §3 (an authenticated re-fetch that itself fails)
behaves acceptably in a real network environment rather than a mocked one.
The `[FOUNDER]` staging steps in §7 are the only way to close the PostHog
gap, and they have not been performed as part of this card.
<!-- END:honesty -->
