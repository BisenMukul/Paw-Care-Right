# Referral grants (T108)

## 1. What a referral grant is

A `ReferralGrant` is a server-side, time-boxed Premium grace window issued to
BOTH parties of an accepted household invite. When a household invite is
accepted (`POST /v1/households/invites/accept`,
`apps/api/src/households/households.service.ts`), the joiner and the
inviter each receive **14 days** of Premium grace. **Fix round (checker
finding F1):** issuance runs in its OWN, separate transaction, immediately
AFTER the invite-accept transaction has already committed — not inside it.
`HouseholdsService.acceptInvite` calls `ReferralGrantService
.issueForAcceptedInvite` in a try/catch that logs and swallows any failure,
so no grant-path error (a DB blip, an unexpected constraint violation,
anything) can ever roll back a join that already succeeded — this makes the
card's "an abuse guard must never fail a household join" (D6) literally
true rather than merely practically unreachable. Grants are read back as a
third, independent input to entitlement resolution
(`apps/api/src/billing/entitlement.util.ts`'s `pickEntitlement`) — a new
`source: "grant"` value alongside the existing `"own"`/`"family"`/`"none"`.

**Issuance is best-effort and at-most-once — a committed join can end with
ZERO grants, permanently (checker finding F8).** The post-commit design's
honest cost is that nothing retries, queues, or repairs a failed issuance:
a process crash between the join's commit and the grant transaction, any
error swallowed by the `try/catch` in `acceptInvite`, Prisma's **default
5-second interactive-transaction timeout** (no timeout options are passed)
expiring while queued behind a popular inviter's advisory lock, an
advisory-lock deadlock, or an error on the second recipient (which rolls
back the first recipient's already-inserted row — both-or-neither) all
produce a 200 OK join with no grants and **no user-visible signal**. Because
the invite's `usedAt` is consumed by the committed join, re-POSTing the
accept returns 404 — there is no path to re-trigger issuance. There is no
outbox, no reconciliation job, and no retry. This is the deliberate price
of guaranteeing that grant logic can never fail a household join; see §7
for the founder decision on whether that price is acceptable for launch.

## 2. Grant math (chaining, stacking cap)

Each recipient's next grant window starts at `max(now, tip of their existing
grants)` and runs for exactly 14 days
(`apps/api/src/billing/referral-grant.util.ts`'s `computeGrantWindow`, D3).
For SERIALIZED issuance, windows for the same recipient never overlap: a
second grant chains onto the first grant's expiry, a third onto the second,
and so on. The *effective* grant expiry reported to the entitlement read
path (`resolveGrantExpiry`, D4) is the contiguous chain's tip — three
stacked grants report **+42 days** of coverage, not just the currently-open
window. A window with a gap before it (the chain already lapsed) is
ignored, not folded in.

**Concurrency correction (fix round, checker finding F2):** `computeGrantWindow`
is a pure function with no concurrency guarantee of its own — read alone,
two concurrent grant-issuance calls crediting the SAME recipient (e.g. two
of an inviter's invites accepted at the same instant by two different
joiners) could each read the same grant history, both compute an
overlapping window, and both insert. The actual non-overlap guarantee is
provided by `ReferralGrantService`, which wraps each accepted invite's
issuance in its own transaction and takes a per-recipient
`pg_advisory_xact_lock(hashtext(userId)::bigint)` (both recipients, in
sorted/deterministic order to avoid a lock-order deadlock between
concurrent MUTUAL accepts) BEFORE either recipient's cap check or insert
runs. This serializes every concurrent writer for a given recipient, making
the chain-non-overlap property real rather than assumed. Proven by a real
Postgres concurrency e2e (`apps/api/test/referrals.e2e-spec.ts`, "F2 fix
round" — two invites from one inviter, accepted concurrently by two
different joiners, credit the same inviter; the two resulting windows are
asserted to be exactly sequential, not overlapping). The earlier wording of
this section ("never lost to concurrency") overstated the guarantee of the
pure function alone; it is now accurate about *where* the guarantee lives.

**Lifetime cap**: a user may RECEIVE at most **3** referral grants, ever
(`REFERRAL_GRANT_MAX_PER_USER`, counted regardless of whether the user was
inviter or joiner on each grant) — a hard ceiling of **42 days** of referral
grace per identity, for life. A recipient at the cap is silently skipped
(D6): the join still succeeds and the other party may still be granted.

**D9 (an honest, contestable call)**: a grant issued to a user with an
ALREADY-ACTIVE paid subscription runs on wall-clock from issue and confers
no visible benefit while that subscription covers the same period —
`pickEntitlement`'s own > family > grant precedence means the RC-sourced
`"own"`/`"family"` entitlement is reported instead, and the grant window
silently elapses unused underneath it. The alternative (deferring the grant
to start when the paid period ends) would require chaining grant math onto
RC's `expiresAt`, which the card's AC ("RC entitlement unaffected") forbids.
See §7.

## 3. RevenueCat is never touched

**No RevenueCat API call, and no `Subscription` row read, write, or mutation
of any kind, anywhere in the referral grant path.**
`apps/api/src/billing/referral-grant.service.ts` and
`apps/api/src/billing/referral-grant.util.ts` do not import, query, or
reference the `Subscription` model or the RC webhook state machine at all —
this is enforced both by code review and by a static guard
(`apps/api/src/billing/referral-doc.spec.ts`, which asserts these two files
contain no `subscription` prisma access). A grant is resolved ENTIRELY
within `pickEntitlement`, as a fallback below `"own"` and `"family"` — it
never changes the `expiresAt`, `plan`, or `status` reported for an
RC-sourced entitlement, and RC's own MRR/entitlement reporting has no
visibility into referral grants at all (they are not mirrored to RC in any
direction). This is the literal implementation of the card's acceptance
criterion: "RC entitlement unaffected (server-side grace only)".

## 4. Abuse guards

1. **Lifetime cap**: 3 grants received per user, ever (§2) — the card's
   named guard.
2. **Idempotency**: the invite's own single-use claim
   (`householdInvite.updateMany({ where: { usedAt: null } })`) means
   `ReferralGrantService.issueForAcceptedInvite` is called at most once per
   invite; `@@unique([inviteId, userId])` on `ReferralGrant` is a second
   backstop. **Fix round (F1):** a collision there is no longer swallowed
   inside `ReferralGrantService` — under the F2 per-recipient advisory lock
   it should be unreachable in practice, and if it ever did occur the error
   propagates out to `HouseholdsService.acceptInvite`'s own try/catch, which
   logs it and swallows it there (after the join has already committed) —
   never a fake silent swallow at the grant-service layer.
3. **Concurrency serialization (F2, fix round)**: `ReferralGrantService`
   takes a per-recipient `pg_advisory_xact_lock` (both recipients, sorted
   order) before reading or writing that recipient's grant history, so two
   concurrent accepts crediting the same recipient cannot double-count
   against the cap or race the chain math. See §2.
4. **Self-grant impossible**: `HouseholdsService.acceptInvite`'s existing
   self-accept guard (409 before the transaction opens) means a user can
   never accept their own household's invite; `ReferralGrantService` also
   defensively no-ops if joiner and inviter ids are ever equal.
5. **Invite minting stays premium-only and owner-only for the FIRST hop
   only** (T075/T026, unchanged): a referral chain can only be STARTED by an
   already-paying account. This does not bound the chain's later hops — a
   user whose current Premium comes from a grant can still mint invites
   during their grace window (D10), so hop 2+ requires no payer at all.
   §5 discusses the resulting blast radius; it is bounded by the lifetime
   cap, not by this guard.

## 5. Residual abuse vectors (known, accepted)

- **Alt-account farming**: a premium owner invites up to 3 accounts they
  control, netting themselves +42 days and each alt +14 days. Bounded by the
  cap; the economic ceiling is 42 free days per identity, not unlimited.
- **Leave/rejoin cycling**: A invites B, B leaves (T077), A re-invites B.
  Each cycle consumes one of B's and one of A's three lifetime grants — still
  bounded by the same cap. A pair-uniqueness guard (blocking repeat grants
  between the same two accounts) was considered and deliberately NOT built
  for this card; the column (`counterpartyUserId`) already exists if this is
  judged insufficient later.
- **Grant-funded invite minting**: a user whose Premium access currently
  comes from a grant can still mint invites during their grace window
  (a grant confers the full Premium tier via the single quota-resolution
  seam), growing the referral graph — every participant remains individually
  capped at +42 days for life.
- **No velocity/IP/device heuristics** — deliberately out of scope for this
  card.

## 6. Privacy (T091 erasure behaviour)

`ReferralGrant.userId` (the recipient) is `onDelete: Cascade` from `User` —
every grant a deleted user RECEIVED is erased with their account, exactly
like every other user-owned row. `counterpartyUserId` and `inviteId` are
`onDelete: SetNull` — **erasing the OTHER party in a grant never revokes
grace this user has already earned**: their row survives, only the
now-dangling reference is nulled out. This is covered by the DMMF
completeness guard (`account-erasure-cascade-completeness.spec.ts`) and by a
dedicated e2e case in `test/account-deletion.e2e-spec.ts`.

Known gap: `ReferralGrant` rows are NOT included in the T091 GDPR export
bundle (`account-export.service.ts` has a fixed schema with no DMMF
completeness guard of its own). The rows carry only ids and two timestamps —
recorded here as an accepted gap, not fixed in this card.

## 7. `[FOUNDER]` open questions

- Referral economics go live server-side with this card: every accepted
  household invite mints up to +14 days of Premium grace for both parties,
  capped at 3 grants (+42 days) per user for life. This cost (forgone
  subscription revenue) has no RevenueCat-side record and will NOT appear in
  RC MRR/entitlement reporting — by design, and by the card's AC.
- **Decision needed (D9)**: should a grant issued while a user is already
  paying be DEFERRED (start once their paid period ends) instead of
  elapsing unused underneath it? Deferring is fairer to the user but couples
  grant math to RC state, which this card's AC explicitly forbids — shipped
  as-is (elapses unused) pending a decision.
- **Decision needed (issuance durability, F8)**: grant issuance is
  best-effort/at-most-once (§1) — a crash, timeout, or swallowed error
  after a committed join silently loses both parties' grants forever, with
  no retry or repair path. Accept this for launch, or fund a follow-up card
  for an outbox/reconciliation sweep before referral marketing pushes
  volume through this path.
- **Decision needed (leave/rejoin cycling, §5)**: is the lifetime cap of 3
  sufficient anti-abuse for launch, or should repeat referrals between the
  same two accounts be blocked outright?
- **Not built (deliberately)**: referral analytics events (no
  `referral_grant`/`referral_redeemed` PostHog event), an admin view of
  grants, velocity/device abuse heuristics, and inclusion of grant rows in
  the GDPR export bundle (§6).
- **Store/legal**: the share copy says "up to 14 days of Premium" to both
  parties (fix round, checker F3 — a capped or already-subscribed recipient
  may see no visible benefit, so the copy is qualified rather than an
  unconditional promise). If the number or the qualifier ever changes,
  `apps/mobile/src/strings.ts` and this document must move together —
  `referral-doc.spec.ts` pins the numbers against
  `REFERRAL_GRANT_DAYS`/`REFERRAL_GRANT_MAX_PER_USER` so a drift fails CI.
