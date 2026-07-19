# Demo seed (SEEDER-1)

A deterministic, idempotent, §7-clean DEMO fixture layered on top of the
existing `dev@pawcareright.local` dev fixture (untouched). It exercises
every product surface with real, varied content so the app is fully
testable on a device: two users sharing one household, three pets with
divergent data density, 60-day health timelines, a care plan with
due-today/upcoming/completed occurrences, a medication reminder, checks
across every urgency tier (including a red-flag EMERGENCY), and a premium
family subscription.

Run it with:

```
pnpm --filter api prisma:seed
```

This is safe to run repeatedly — each run wipes and recreates ONLY the
demo rows described below (by fixed id / known demo email), never the dev
fixture or anything else.

## Demo accounts

| Role | Email | Household seen |
|---|---|---|
| Owner | `owner@pawcareright.local` | The Demo Household |
| Family member | `family@pawcareright.local` | The Demo Household |

There is no password — sign-in is via a one-time email code (OTP), and in
non-production this app logs the code to the API console instead of
sending a real email.

### Sign-in walkthrough (either demo user)

1. In the mobile app's welcome/email screen, enter the demo user's email
   (`owner@pawcareright.local` or `family@pawcareright.local`) and request
   a code. This calls `POST /auth/otp/request`.
2. Look at the API server's console/log output for a line like:
   `OTP for owner@pawcareright.local: 123456`
3. Enter that 6-digit code in the app's OTP screen. This calls
   `POST /auth/otp/verify`, which signs the user in and returns their
   session — both demo users land on the same shared household.

`family@pawcareright.local` also owns a second, empty household purely so
sign-in succeeds under the current auth invariant (a user must own at
least one household). It has no members, no pets, and never appears on
any screen — every data screen resolves scope from the family member's
single real membership in The Demo Household.

## The 3 pets (divergent data density)

| Pet | Species / breed | Age | Density |
|---|---|---|---|
| Buddy | Dog, Labrador Retriever | ~4 years | **Rich** — full 60-day weight trend, all 7 logged activity types (several today), notes/meals/vet visits, a fully completed care plan + a medication reminder, and checks across REASSURE / MONITOR / VET_24H / a red-flag EMERGENCY |
| Cleo | Cat, Siamese | ~6 years | **Moderate** — a shorter weight trend, a few logs, a partially-completed care plan, and checks across VET_SOON / FALLBACK |
| Luna | Cat, Maine Coon | ~4 months | **Sparse** — a brand-new pet: 1 weight log, 1 minimal activity log, and a care plan with only future (never-yet-due) occurrences |

## Idempotency contract

Every seed run performs **wipe-and-recreate** of the demo subgraph only:

1. Delete any existing demo `Subscription`, then The Demo Household
   (cascades its pets, checks, reminders, health logs, and memberships),
   then the family member's empty owned household, then the two demo
   `User` rows (cascades their devices) — strictly by fixed id / the two
   demo emails.
2. Recreate everything from scratch with the same fixed ids.

Running the seed twice in a row produces identical row counts (no
duplicates) and never touches `dev@pawcareright.local` or any other row.

## Screen -> data map

| Screen | Backed by |
|---|---|
| Pets list / pet profile | The 3 pets above |
| Health timeline | Seeded `HealthLog` rows (weight, meals, notes, vet visits, activities) — `MED_GIVEN`/`CHECK_REF` entries are read-time projections of the reminder/check data below, not separate rows |
| Care plan / agenda ("Today") | Seeded `Reminder` + `ReminderEvent` rows — due-today, upcoming, and completed occurrences |
| Medication reminder | Buddy's `MEDICATION`-type reminder, with a record-only name/dose (never a suggested drug or dosage) |
| Symptom checks / history | Seeded `SymptomCheck` + `TriageResult` rows across every urgency tier, one `FALLBACK`, and one red-flag `EMERGENCY_NOW`, plus a "better" and a "worse" (escalating) follow-up |
| Family / household sharing | The owner + family member membership rows in The Demo Household |
| Billing / paywall | An active `PREMIUM` family-plan `Subscription`, entitling both household members |
| Devices / push settings | One demo `Device` row per user |
