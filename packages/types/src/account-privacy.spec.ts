import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_EXPORT_RETENTION_DAYS,
  accountDeletionStatusSchema,
  accountExportRequestSchema,
  accountPrivacySettingsSchema,
  EXPORT_LINK_TTL_SECONDS,
  updateAccountPrivacySettingsSchema,
} from "./account-privacy";

describe("account-privacy constants (D2/D6 — pinned for C3 counsel review)", () => {
  it("ACCOUNT_DELETION_GRACE_DAYS is 30", () => {
    expect(ACCOUNT_DELETION_GRACE_DAYS).toBe(30);
  });

  it("ACCOUNT_EXPORT_RETENTION_DAYS is 7", () => {
    expect(ACCOUNT_EXPORT_RETENTION_DAYS).toBe(7);
  });

  it("EXPORT_LINK_TTL_SECONDS is 7 days in seconds", () => {
    expect(EXPORT_LINK_TTL_SECONDS).toBe(604_800);
  });
});

describe("accountPrivacySettingsSchema", () => {
  const VALID = { analyticsOptOut: false, deletionScheduledAt: null };

  it("accepts a valid payload with deletionScheduledAt: null", () => {
    expect(accountPrivacySettingsSchema.parse(VALID)).toEqual(VALID);
  });

  it("accepts a valid payload with a datetime deletionScheduledAt", () => {
    const payload = { analyticsOptOut: true, deletionScheduledAt: "2026-08-24T04:15:00.000Z" };
    expect(accountPrivacySettingsSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a non-ISO deletionScheduledAt", () => {
    const payload = { ...VALID, deletionScheduledAt: "not-a-date" };
    expect(accountPrivacySettingsSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects a missing analyticsOptOut", () => {
    const payload: Record<string, unknown> = { ...VALID };
    delete payload.analyticsOptOut;
    expect(accountPrivacySettingsSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an unknown extra key (.strict())", () => {
    const payload = { ...VALID, extra: true };
    expect(accountPrivacySettingsSchema.safeParse(payload).success).toBe(false);
  });
});

describe("updateAccountPrivacySettingsSchema", () => {
  it("accepts { analyticsOptOut: true }", () => {
    expect(updateAccountPrivacySettingsSchema.parse({ analyticsOptOut: true })).toEqual({
      analyticsOptOut: true,
    });
  });

  it("rejects a non-boolean analyticsOptOut", () => {
    expect(updateAccountPrivacySettingsSchema.safeParse({ analyticsOptOut: "true" }).success).toBe(false);
  });

  it("rejects an unknown extra key (.strict())", () => {
    expect(
      updateAccountPrivacySettingsSchema.safeParse({ analyticsOptOut: true, deletionScheduledAt: null }).success,
    ).toBe(false);
  });
});

describe("accountExportRequestSchema", () => {
  const VALID = {
    exportId: "550e8400-e29b-41d4-a716-446655440000",
    status: "PENDING",
    requestedAt: "2026-07-25T00:00:00.000Z",
  };

  it("accepts a valid payload", () => {
    expect(accountExportRequestSchema.parse(VALID)).toEqual(VALID);
  });

  it.each(["PENDING", "DONE", "FAILED"])("accepts status %p", (status) => {
    expect(accountExportRequestSchema.parse({ ...VALID, status }).status).toBe(status);
  });

  it("rejects an unknown status", () => {
    expect(accountExportRequestSchema.safeParse({ ...VALID, status: "RUNNING" }).success).toBe(false);
  });

  it("rejects a non-uuid exportId", () => {
    expect(accountExportRequestSchema.safeParse({ ...VALID, exportId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects an unknown extra key (.strict())", () => {
    expect(accountExportRequestSchema.safeParse({ ...VALID, extra: 1 }).success).toBe(false);
  });
});

describe("accountDeletionStatusSchema", () => {
  it("accepts a null deletionScheduledAt", () => {
    expect(accountDeletionStatusSchema.parse({ deletionScheduledAt: null })).toEqual({
      deletionScheduledAt: null,
    });
  });

  it("accepts a datetime deletionScheduledAt", () => {
    const payload = { deletionScheduledAt: "2026-08-24T04:15:00.000Z" };
    expect(accountDeletionStatusSchema.parse(payload)).toEqual(payload);
  });

  it("rejects an unknown extra key (.strict())", () => {
    expect(accountDeletionStatusSchema.safeParse({ deletionScheduledAt: null, extra: 1 }).success).toBe(false);
  });
});
