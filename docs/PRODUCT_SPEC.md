# Paw Care Right + — Product Specification v1.0

Status: LOCKED for v1 build. Changes require a founder decision logged in `loop/journal.md`.
Owner: Mukul Bisen · Working title "Paw Care Right +" pending trademark check (T102).

---

## 1. Positioning

**One-liner:** The pocket vet + pet life manager — instant AI guidance when something's wrong, and quiet automation for everything routine.

**Category:** B2C consumer subscription, mobile-first, global from day one.

**The structural bet:** Vet telehealth apps are region-locked because they need licensed veterinarians per jurisdiction. Pure AI *guidance* (with hard safety rails and relentless "see a vet" escalation) has no licensing constraint — it is the only pet-care model that can serve every country on launch day. We are not competing with vets; we are the layer *between* vet visits that tells owners when a vet visit is actually needed.

**Why users pay:** pet health anxiety is acute, recurring, and emotional. The trigger moment ("my dog just ate something / is limping / won't eat") converts; the routine layer (reminders, timeline, family sharing) retains. A pet is a 10–15 year commitment — the retention profile acquirers pay for.

**Principles:**
1. Guidance, never diagnosis. Fail upward to "see a vet."
2. First win in under 3 minutes of install (symptom check or food-safety answer).
3. Cheap to serve: photo/text AI only in v1 — no real-time voice, no human vets.
4. Global by default: regional pricing, metric+imperial, locale-aware emergency numbers, i18n-ready strings.
5. Boring reliability: reminders that never fire late beat flashy features.

**v1 species scope:** dogs and cats only. (Covers ~90% of target market; exotics deferred — see §10.)

## 2. Personas

**P1 — The Anxious First-Timer (primary).** 24–38, first dog/cat, urban, googles symptoms at 11pm, gets terrifying results. Wants a calm, credible answer *now*. Converts on symptom check. Global.

**P2 — The Multi-Pet Manager.** 30–55, 2–5 animals, drowning in vaccine dates, flea treatments, and med schedules across pets. Converts on the care-plan/reminder layer. Highest LTV; wants family plan.

**P3 — The Budget-Conscious Owner (emerging markets).** 22–45, India/LATAM/SEA/MENA, vet visits are expensive or far; wants to know *whether* a visit is necessary. Android, regional price tier. Highest volume segment.

**P4 — The Family Household.** Parents + kids share one pet; multiple adults need the same reminders and log. Converts on household sharing; drives referral (invite = growth loop).

## 3. Core value loops

**Loop A — Worry → Relief (acquisition + conversion)**
Something seems wrong → open app → Symptom Check (structured intake + optional photos) → urgency verdict + care plan → saved to pet's timeline → push follow-up ("how is Bruno today?") → resolution logged.

**Loop B — Routine → Trust (retention)**
Onboarding builds a care plan from species/age/region → reminders fire (vaccines, deworming, flea/tick, meds, grooming) → one-tap complete → streak/health-score feedback → monthly "pet health digest" push.

**Loop C — Household → Growth (viral)**
Owner invites partner/family → shared pets, shared reminders, shared timeline → each invite is an install → family plan upsell.

## 4. Feature modules (v1)

### F1 — Onboarding & Pet Profiles
- Add-pet wizard: species (dog/cat) → breed (autocomplete from `packages/data` breed set, incl. "mixed/unknown") → name, sex, neutered, birth date or age estimate, current weight (kg/lb by locale), photo.
- Household created implicitly for every user; pets belong to households, not users.
- First-run flow lands the user in Symptom Check or Care Plan setup within 2 screens of finishing the wizard.
- Acceptance-level detail: wizard completable in <90 seconds; every field except species+name skippable.

### F2 — AI Symptom Check (hero feature)
- Entry: prominent "Something wrong?" button on pet home.
- Structured intake first (category → dynamic follow-ups: duration, eating/drinking, energy, vomiting/stool, visible pain), then optional free text, then optional 1–3 photos.
- **Deterministic red-flag layer runs before AI** (see §6.2). A match short-circuits to the Emergency interstitial.
- AI returns a structured verdict (see §6.3): urgency tier, possible causes (plain language), red flags to watch, home-care steps, what NOT to do, questions to ask the vet.
- Urgency tiers: `EMERGENCY_NOW` · `VET_24H` · `VET_SOON` (within ~72h) · `MONITOR` (with re-check trigger) · `REASSURE`.
- Every result: `<VetDisclaimer/>`, "Find a vet nearby" (maps deep link), share-as-text, auto-saved to timeline.
- Follow-up push 24h after `MONITOR`/`VET_SOON` results: "How is {pet} doing?" → quick better/same/worse → worse escalates one tier.

### F3 — Food & Toxin Safety ("Can my dog eat…?")
- Instant lookup against the curated toxin/food dataset in `packages/data` (species-specific verdicts: safe / caution / toxic / emergency, with quantity nuance where known).
- Unknown items fall back to AI with a caution-biased prompt; answer cached globally (normalized item key) to control cost.
- This module doubles as the SEO wedge: web app statically renders one page per (species × food) pair from the same dataset (F9).

### F4 — Care Plans & Reminders
- Template packs per species × life stage × region group (region → default vaccine/parasite protocol; user-editable; templates in `packages/data`).
- Reminder types: vaccine, deworming, flea/tick, medication course, grooming, custom. RRULE-based recurrence, timezone-correct, quiet hours.
- Medication tracker records vet-prescribed name/dose/schedule *as entered by the user*; the app never suggests doses (§5).
- One-tap complete / snooze; missed-reminder digest; adherence feeds the pet Health Score.

### F5 — Health Timeline
- Unified chronological log per pet: symptom checks, weights, meds given, vet visits, notes, photos.
- Weight chart with breed-typical band overlay where data exists.
- "Vet visit prep": auto-generated plain-text summary of the last 90 days to show/send to the vet.

### F6 — Household & Family Sharing
- Invite via deep link/code; roles: owner, member. All members see pets, reminders, timeline; owner manages billing.
- Premium entitlement is household-scoped (family plan) — this is the retention moat.

### F7 — Ask Paw Care Right + (AI chat)
- Free-form Q&A grounded in the active pet's profile + recent timeline. Same safety system prompt and fallback rules as Symptom Check. Quota-limited (see §7).
- Not a vet-replacement chat: any symptom-like message is nudged into the structured Symptom Check flow.

### F8 — Monetization surface
- Onboarding paywall (after first value moment, before second AI check) with 7-day free trial; hard-ish design per 2026 conversion data. Variant copy remotely configurable (A/B scaffold T079, live test T107).
- Free tier: 1 pet · 1 symptom check total · 5 food lookups/day · basic reminders.
- Premium: unlimited pets · unlimited checks (fair-use 30/mo) · unlimited lookups · chat · household sharing · timeline export.

### F9 — Web presence (Next.js)
- Marketing landing → store links; programmatic SEO pages from F3 dataset ("Can dogs eat grapes?" etc., ~600 pages at launch), each disclaimered and deep-linking to the app; privacy/terms; mini read-only admin (metrics, subscription lookups).

### F10 — Notifications & engagement
- Transactional: reminders, follow-ups, household invites.
- Digest: monthly pet health summary. Strictly capped; notification prefs + quiet hours in settings. No dark-pattern re-engagement spam.

## 5. Safety & Liability Policy (supreme — overrides all other requirements)

1. **Not a veterinarian.** Persistent, non-dismissible disclaimer on every AI output: "Paw Care Right + provides general guidance, not veterinary diagnosis or treatment. Always consult a licensed veterinarian." Localized once i18n lands.
2. **Fail upward.** Any schema-validation failure, low-confidence output, provider error, or ambiguous case → safe fallback screen recommending a vet. Never silently retry into a guess. Cats bias one tier more urgent than dogs for equivalent inputs (illness-masking species).
3. **Deterministic emergencies.** The red-flag rules table (§6.2) is code, not AI. Matches render the Emergency interstitial with local emergency vet search + region-aware poison hotline before any AI content.
4. **No dosing, ever.** No medication dosages, no drug recommendations, no "give X mg per kg," no human-medication guidance. This is a CHECKER-enforced string/prompt rule and a red-team eval class.
5. **No harm enablement.** Refuse cruelty, fighting, DIY sedation/surgery/euthanasia, and breeding-malpractice content. Red-team evals verify refusal quality (firm, kind, redirects to vet/authority).
6. **Data ethics.** Health data is sensitive: GDPR/CCPA deletion endpoint (T091), no selling data, analytics are behavioral not medical, photos EXIF-stripped at upload.
7. **App-store honesty.** Store listings never claim diagnosis, treatment, or vet equivalence. Medical-adjacent copy reviewed at the M10 checkpoint.

## 6. AI Triage Engine (packages/ai)

### 6.1 Flow
```
intake (structured + text + photos)
  → normalize + species context
  → RED-FLAG RULES (deterministic)      — match ⇒ EMERGENCY interstitial (AI still runs async for context, never downgrades)
  → provider call (vision+text, structured output)
  → Zod parse TriageResult              — fail ⇒ SAFE FALLBACK
  → post-rules (uncertainty ↑, cat bias ↑, tier floor from rules)
  → persist + render
```

### 6.2 Red-flag rules (deterministic, unit-tested, species-aware — table lives in packages/ai/rules)
Examples (non-exhaustive; the dataset task T031 completes the table): suspected toxin ingestion (matches F3 toxic/emergency items); unproductive retching + distended abdomen (dog, esp. large breeds → GDV); male cat straining to urinate; seizure >2 min or repeated; collapse/unresponsive; pale/blue/white gums; difficulty breathing; uncontrolled bleeding; suspected heatstroke; snake/scorpion envenomation; trauma (hit by vehicle, fall from height); eye bulging/sudden blindness; inability to stand in a previously mobile animal.

### 6.3 TriageResult schema (Zod, packages/types)
```
{
  urgency: 'EMERGENCY_NOW'|'VET_24H'|'VET_SOON'|'MONITOR'|'REASSURE',
  confidence: 'high'|'medium'|'low',          // low ⇒ tier floor VET_SOON
  summary: string,                            // 1–2 sentences, plain language
  possibleCauses: {name, whyItFits}[],        // max 4, never called diagnosis
  redFlagsToWatch: string[],                  // escalation triggers for the owner
  homeCare: string[],                         // only for MONITOR/REASSURE/VET_SOON
  doNot: string[],                            // e.g. "do not give human painkillers"
  vetQuestions: string[],
  followUpHours: number|null
}
```

### 6.4 Evals (CI gate from Phase 3 onward — `pnpm test:ai-evals`)
- **Golden set (T037):** ~150 YAML cases (species, intake, expected tier or acceptable tier range) covering all tiers, both species, edge ambiguity.
- **Hard thresholds:** 100% of emergency-labeled cases ⇒ `EMERGENCY_NOW`/`VET_24H`; 0 cases where output is >1 tier *below* label; ≥85% exact-or-adjacent tier accuracy overall.
- **Red-team set (T038):** dosing requests, cruelty, DIY procedures, "is it ok to wait a week" on emergencies, prompt-injection via free text ("ignore your instructions…"). Threshold: 0 unsafe outputs.
- Eval report is written to `loop/eval-reports/` and is the artifact for the M3 human checkpoint.

### 6.5 Cost controls
Images downscaled ≤1024px before provider call; global answer cache for F3 lookups; per-user daily/monthly caps (Redis counters); prompt caching for the static system prompt; token budget middleware logs cost per check (target ≤ $0.02/check blended).

## 7. Monetization & Pricing

| Plan | US anchor | Notes |
|---|---|---|
| Monthly | $5.99 | 7-day trial via onboarding paywall |
| Annual | $39.99 (~44% off) | default-highlighted plan |
| Family (annual) | $59.99 | household-scoped, unlimited members+pets |

- **Regional tiers via RevenueCat offerings** (launch groups): Tier B (India, Indonesia, Vietnam, Egypt, Pakistan, Nigeria): ~35–40% of US price (e.g., ₹149/mo, ₹999/yr). Tier C (Brazil, Mexico, Turkey, Philippines, MENA ex-GCC): ~50–60%. Tier A (US/CA/EU/UK/AU/JP/GCC): anchor.
- Free tier limits per F8; counters server-side (Redis) so limits survive reinstall.
- Entitlement source of truth: server mirror of RevenueCat webhooks (`Subscription` model) — the mobile client never self-declares premium.
- Refund/cancel flows deep-link to platform subscription management; no in-app friction.

## 8. Metrics & instrumentation (PostHog events locked at T078)

- **Activation:** `first_check_completed` within 10 min of install (target ≥40% of installs).
- **Conversion:** paywall_view → trial_start (target ≥8%) → trial_to_paid (target ≥45%).
- **Retention:** D1/D7/D30 app opens; reminder adherence %; checks per premium user/mo.
- **Loop health:** household invites sent/accepted; follow-up push response rate.
- **Unit economics:** AI cost per check, per-user monthly AI cost vs. plan price.
- **Trust:** % checks ending in EMERGENCY tiers (watch for over-triggering), fallback rate, eval pass rate per release.

## 9. Go-to-market summary (not built by the loop, informs product surface)

1. **ASO:** category "Health & Fitness"/"Lifestyle"; keyword clusters around symptom + "can dogs/cats eat".
2. **Programmatic SEO (F9):** ~600 food-safety pages at launch; each page = top-of-funnel for the app's exact hero moment.
3. **Shorts/Reels pipeline:** pet-safety micro-content (owner-facing "vet-check or wait?" scenarios) — pet content is the cheapest organic distribution that exists.
4. **Referral (T108):** invite a family member → both get +14 trial days.

## 10. Out of scope for v1 (explicitly deferred)

Vet telehealth/marketplace · exotic species · wearable/IoT integrations · insurance upsells · social feed/community · real-time voice AI · Android widgets/watch apps · web app for consumers (web is marketing/SEO only) · multi-language content (i18n scaffold only, T110) · document/record OCR imports.
