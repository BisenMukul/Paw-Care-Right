import { Prisma } from "@prisma/client";

/**
 * F2 (checker review, T091): a systemic guard against the F1 failure mode
 * ("a user-owned model exists that the erasure cascade never enumerated").
 * `AccountErasureService`'s hand-written table list
 * (`account-deletion.e2e-spec.ts`'s AC1 enumeration + this service's own
 * `$transaction` bodies) has no automatic cross-check against the Prisma
 * schema -- a future model could be added, ship with a fully green suite,
 * and silently escape both `DELETE /me`'s cascade and its own test coverage.
 *
 * This test enumerates every model from the Prisma DMMF (the same schema
 * `schema.prisma` compiles to -- no separate file-parsing step to drift
 * from the real schema) and asserts each one is EITHER:
 *  - in `CASCADE_COVERED_MODELS` (reached by `AccountErasureService`'s
 *    erasure -- directly hard-deleted, or FK-`onDelete: Cascade`d from
 *    `User`/`Household`/`Pet` once those are removed), OR
 *  - in `EXEMPT_MODELS` with a recorded reason (a model that is
 *    structurally incapable of being user-owned).
 *
 * Adding a new model to `schema.prisma` without adding it to EITHER list
 * here fails this test -- forcing a deliberate erasure decision (add a
 * cascade branch, or record why erasure doesn't apply) rather than letting
 * it silently ship uncovered.
 */

/**
 * Every model `AccountErasureService.erase()` is proven to reach (see
 * `account-erasure.service.spec.ts`'s ordering assertions and
 * `test/account-deletion.e2e-spec.ts`'s full 19-table cascade proof):
 * hard-deleted directly in one of the two `$transaction` bodies, or
 * FK-cascaded transitively once `User`/`Household`/`Pet` are removed.
 */
const CASCADE_COVERED_MODELS = [
  "User",
  "Household",
  "Membership",
  "Device",
  "UserNotificationPrefs",
  "RefreshToken",
  "Pet",
  "HouseholdInvite",
  "SymptomCheck",
  "TriageResult",
  "CheckFollowUp",
  "Reminder",
  "ReminderEvent",
  "HealthLog",
  "Subscription",
  "ChatThread",
  "ChatMessage",
  "AccountExport",
  "AiAuditLog",
  // T104: FK-cascades from `User` (`onDelete: Cascade`); its S3
  // `feedback/<userId>/` screenshot prefix is erased alongside the row by
  // `account-erasure.service.ts`'s two `listKeys` calls (mirrors `AccountExport`).
  "FeedbackReport",
] as const;

/**
 * Models a deliberate decision has recorded as OUT of the erasure cascade,
 * with the reason a human (or the checker) verified.
 */
const EXEMPT_MODELS: Record<string, string> = {
  ProcessedWebhookEvent:
    "Global RevenueCat webhook-dedup table -- shape is exactly { eventId, processedAt }, no userId/householdId/petId column, never user-owned (T073 plan). Nothing to erase per-account.",
};

describe("AccountErasureService cascade completeness guard (F2, T091)", () => {
  it("every model in schema.prisma is accounted for -- cascade-covered or explicitly exempt with a reason", () => {
    const allModelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);

    const covered = new Set(CASCADE_COVERED_MODELS);
    const exempt = new Set(Object.keys(EXEMPT_MODELS));

    // The two lists must never overlap -- a model is either erased or
    // explicitly exempt, never claimed as both.
    const overlap = [...covered].filter((name) => exempt.has(name));
    expect(overlap).toEqual([]);

    const unaccounted = allModelNames.filter((name) => !covered.has(name) && !exempt.has(name));
    expect(unaccounted).toEqual([]);

    // Every EXEMPT_MODELS entry must carry a non-empty reason -- an empty
    // string would silently defeat the guard's own intent.
    for (const [name, reason] of Object.entries(EXEMPT_MODELS)) {
      expect(reason.length).toBeGreaterThan(0);
      expect(allModelNames).toContain(name);
    }

    // Sanity: the lists together are exactly the full model set (no stale
    // entries left behind for a model that was since removed from the schema).
    expect([...covered, ...exempt].sort()).toEqual([...allModelNames].sort());
  });

  it("pins the current exempt list to exactly ProcessedWebhookEvent (a change here must be a deliberate PR, not silent drift)", () => {
    expect(Object.keys(EXEMPT_MODELS)).toEqual(["ProcessedWebhookEvent"]);
  });
});
