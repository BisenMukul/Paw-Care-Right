import {
  adminAuditPageSchema,
  adminAuditRowSchema,
  adminKpiDaySchema,
  adminKpisResponseSchema,
  adminTierSnapshotSchema,
  adminUserCountersSchema,
  adminUserSummarySchema,
} from "./admin";

function buildValidKpiDay(): Record<string, unknown> {
  return {
    day: "2026-07-30",
    devicesCreated: 4,
    checksCreated: 10,
    checksDone: 8,
    checksFallback: 2,
    fallbackRate: 0.2,
    billingEventsProcessed: 1,
    subscriptionsUpdated: 1,
  };
}

function buildValidTierSnapshot(): Record<string, unknown> {
  return {
    totalUsers: 100,
    premiumSubscriptions: 10,
    expiredOrInactiveSubscriptions: 5,
    activeReferralGrants: 3,
  };
}

function buildValidCounters(): Record<string, unknown> {
  return {
    pets: 2,
    symptomChecksTotal: 5,
    symptomChecksFallback: 1,
    chatThreads: 1,
    chatMessages: 3,
    reminders: 4,
    healthLogs: 6,
    devices: 1,
    feedbackReports: 0,
    accountExports: 0,
    referralGrantsActive: 0,
  };
}

function buildValidUserSummary(): Record<string, unknown> {
  return {
    userId: "user-1",
    email: "owner@bombaypetcompany.local",
    createdAt: "2026-01-01T00:00:00.000Z",
    locale: "en",
    region: "US",
    analyticsOptOut: false,
    deletionScheduledAt: null,
    householdIds: ["household-1"],
    entitlement: { entitled: true, source: "own", plan: "annual", expiresAt: null, billingIssue: false },
    counters: buildValidCounters(),
  };
}

function buildValidAuditRow(): Record<string, unknown> {
  return {
    id: "audit-1",
    surface: "CHECK",
    checkId: "check-1",
    threadId: null,
    promptVersion: "v1",
    modelId: "model-1",
    detectorFlags: ["red_flag_hit"],
    costMicroUsd: 120,
    latencyMs: 800,
    status: "OK",
    createdAt: "2026-07-30T00:00:00.000Z",
  };
}

describe("adminKpiDaySchema", () => {
  it("accepts a valid day", () => {
    expect(adminKpiDaySchema.parse(buildValidKpiDay())).toEqual(buildValidKpiDay());
  });

  it("accepts a null fallbackRate (0/0 -- never a fake 0%)", () => {
    const day = { ...buildValidKpiDay(), fallbackRate: null };
    expect(adminKpiDaySchema.parse(day)).toEqual(day);
  });

  it("rejects a fallbackRate above 1", () => {
    expect(() => adminKpiDaySchema.parse({ ...buildValidKpiDay(), fallbackRate: 1.5 })).toThrow();
  });

  it("rejects a fallbackRate below 0", () => {
    expect(() => adminKpiDaySchema.parse({ ...buildValidKpiDay(), fallbackRate: -0.1 })).toThrow();
  });

  it("rejects an unrecognized extra key (.strict())", () => {
    expect(() => adminKpiDaySchema.parse({ ...buildValidKpiDay(), extra: "nope" })).toThrow();
  });
});

describe("adminTierSnapshotSchema", () => {
  it("accepts a valid snapshot", () => {
    expect(adminTierSnapshotSchema.parse(buildValidTierSnapshot())).toEqual(buildValidTierSnapshot());
  });

  it("rejects a negative count", () => {
    expect(() =>
      adminTierSnapshotSchema.parse({ ...buildValidTierSnapshot(), totalUsers: -1 }),
    ).toThrow();
  });
});

describe("adminKpisResponseSchema", () => {
  it("accepts a valid response", () => {
    const response = {
      days: 30,
      generatedAt: "2026-07-30T00:00:00.000Z",
      daily: [buildValidKpiDay()],
      tiers: buildValidTierSnapshot(),
    };
    expect(adminKpisResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty daily array", () => {
    const response = {
      days: 30,
      generatedAt: "2026-07-30T00:00:00.000Z",
      daily: [],
      tiers: buildValidTierSnapshot(),
    };
    expect(adminKpisResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects a non-positive days value", () => {
    expect(() =>
      adminKpisResponseSchema.parse({
        days: 0,
        generatedAt: "2026-07-30T00:00:00.000Z",
        daily: [],
        tiers: buildValidTierSnapshot(),
      }),
    ).toThrow();
  });
});

describe("adminUserCountersSchema", () => {
  it("accepts valid counters", () => {
    expect(adminUserCountersSchema.parse(buildValidCounters())).toEqual(buildValidCounters());
  });

  it("rejects a negative counter", () => {
    expect(() => adminUserCountersSchema.parse({ ...buildValidCounters(), pets: -1 })).toThrow();
  });

  it("rejects an unrecognized extra key (.strict()) -- a content field could never ride along", () => {
    expect(() =>
      adminUserCountersSchema.parse({ ...buildValidCounters(), petName: "Fido" }),
    ).toThrow();
  });
});

describe("adminUserSummarySchema", () => {
  it("accepts a valid summary", () => {
    expect(adminUserSummarySchema.parse(buildValidUserSummary())).toEqual(buildValidUserSummary());
  });

  it("accepts a non-null deletionScheduledAt", () => {
    const summary = { ...buildValidUserSummary(), deletionScheduledAt: "2026-08-01T00:00:00.000Z" };
    expect(adminUserSummarySchema.parse(summary)).toEqual(summary);
  });

  it("rejects an unrecognized extra key (.strict()) -- e.g. a planted pet name or symptom text field", () => {
    expect(() =>
      adminUserSummarySchema.parse({ ...buildValidUserSummary(), petName: "Fido" }),
    ).toThrow();
    expect(() =>
      adminUserSummarySchema.parse({ ...buildValidUserSummary(), symptomText: "vomiting" }),
    ).toThrow();
  });

  it("rejects a missing required field", () => {
    const summary = buildValidUserSummary();
    delete summary.email;
    expect(() => adminUserSummarySchema.parse(summary)).toThrow();
  });
});

describe("adminAuditRowSchema", () => {
  it("accepts a valid CHECK row", () => {
    expect(adminAuditRowSchema.parse(buildValidAuditRow())).toEqual(buildValidAuditRow());
  });

  it("accepts a valid CHAT row (threadId set, checkId null)", () => {
    const row = { ...buildValidAuditRow(), surface: "CHAT", checkId: null, threadId: "thread-1" };
    expect(adminAuditRowSchema.parse(row)).toEqual(row);
  });

  it("accepts a null latencyMs", () => {
    const row = { ...buildValidAuditRow(), latencyMs: null };
    expect(adminAuditRowSchema.parse(row)).toEqual(row);
  });

  it("rejects an unknown surface value", () => {
    expect(() => adminAuditRowSchema.parse({ ...buildValidAuditRow(), surface: "OTHER" })).toThrow();
  });

  it("rejects an unknown status value", () => {
    expect(() => adminAuditRowSchema.parse({ ...buildValidAuditRow(), status: "PENDING" })).toThrow();
  });

  it("rejects an unrecognized/extra key (.strict() non-vacuity -- a future content column can never ride along)", () => {
    expect(() =>
      adminAuditRowSchema.parse({ ...buildValidAuditRow(), intakeText: "vomiting since this morning" }),
    ).toThrow();
  });
});

describe("adminAuditPageSchema", () => {
  it("accepts a valid page with a non-null nextCursor", () => {
    const page = { rows: [buildValidAuditRow()], nextCursor: "audit-2" };
    expect(adminAuditPageSchema.parse(page)).toEqual(page);
  });

  it("accepts a null nextCursor (last page)", () => {
    const page = { rows: [buildValidAuditRow()], nextCursor: null };
    expect(adminAuditPageSchema.parse(page)).toEqual(page);
  });

  it("rejects an invalid row nested inside rows", () => {
    const page = { rows: [{ ...buildValidAuditRow(), status: "PENDING" }], nextCursor: null };
    expect(() => adminAuditPageSchema.parse(page)).toThrow();
  });
});
