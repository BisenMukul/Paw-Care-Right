import { Prisma } from "@prisma/client";

import type { AnalyticsService } from "../analytics/analytics.service";
import type { PrismaService } from "../prisma/prisma.service";
import { RcWebhookService } from "./rc-webhook.service";

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
}

function buildEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: "evt_1",
      type: "RENEWAL",
      app_user_id: "user-1",
      product_id: "pawcareright_monthly",
      expiration_at_ms: Date.parse("2026-08-16T12:00:00.000Z"),
      event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
      ...overrides,
    },
  };
}

interface TxMock {
  processedWebhookEvent: { create: jest.Mock };
  subscription: { findUnique: jest.Mock; upsert: jest.Mock };
  membership: { findFirst: jest.Mock };
}

function buildTx(overrides: Partial<TxMock> = {}): TxMock {
  return {
    processedWebhookEvent: { create: jest.fn().mockResolvedValue({}) },
    subscription: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    membership: { findFirst: jest.fn().mockResolvedValue({ householdId: "household-1" }) },
    ...overrides,
  } as TxMock;
}

function buildAnalytics(overrides: { capture?: jest.Mock } = {}) {
  const capture = overrides.capture ?? jest.fn();
  return { analytics: { capture } as unknown as AnalyticsService, capture };
}

function buildService(
  tx: TxMock,
  overrides: { analytics?: AnalyticsService } = {},
): { service: RcWebhookService; tx: TxMock } {
  const prisma = {
    $transaction: jest.fn((cb: (tx: TxMock) => unknown) => cb(tx)),
  } as unknown as PrismaService;
  const analytics = overrides.analytics ?? buildAnalytics().analytics;
  return { service: new RcWebhookService(prisma, analytics), tx };
}

describe("RcWebhookService.handle", () => {
  it("replay-safe: a P2002 on the dedupe insert -> no upsert, still acks {received:true}", async () => {
    const tx = buildTx({
      processedWebhookEvent: { create: jest.fn().mockRejectedValue(p2002()) },
    });
    const { service } = buildService(tx);

    const result = await service.handle(buildEnvelope());

    expect(result).toEqual({ received: true });
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
  });

  it("unknown/anonymous app_user_id with no existing row -> no upsert, still acks", async () => {
    const tx = buildTx({
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
      subscription: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    });
    const { service } = buildService(tx);

    const result = await service.handle(buildEnvelope({ app_user_id: "$RCAnonymousID:abc" }));

    expect(result).toEqual({ received: true });
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.processedWebhookEvent.create).toHaveBeenCalledWith({ data: { eventId: "evt_1" } });
  });

  it("stale event (older ts than the existing row's lastEventAt) -> skip, no upsert", async () => {
    const tx = buildTx({
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          lastEventAt: new Date("2026-07-16T13:00:00.000Z"),
          householdId: "household-1",
        }),
        upsert: jest.fn(),
      },
    });
    const { service } = buildService(tx);

    const result = await service.handle(
      buildEnvelope({ event_timestamp_ms: Date.parse("2026-07-16T09:00:00.000Z") }),
    );

    expect(result).toEqual({ received: true });
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
  });

  it("householdId is re-stamped at write time from the purchaser's CURRENT membership", async () => {
    const tx = buildTx({
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ lastEventAt: null, householdId: "old-household" }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      membership: { findFirst: jest.fn().mockResolvedValue({ householdId: "new-household" }) },
    });
    const { service } = buildService(tx);

    await service.handle(buildEnvelope());

    expect(tx.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rcAppUserId: "user-1" },
        create: expect.objectContaining({ householdId: "new-household" }),
        update: expect.objectContaining({ householdId: "new-household" }),
      }),
    );
  });

  it("falls back to the existing row's householdId when no current membership resolves", async () => {
    const tx = buildTx({
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ lastEventAt: null, householdId: "existing-household" }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const { service } = buildService(tx);

    await service.handle(buildEnvelope());

    expect(tx.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ householdId: "existing-household" }),
      }),
    );
  });

  it("unknown event type -> dedupe-recorded, no upsert, still acks", async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    const result = await service.handle(buildEnvelope({ type: "TRANSFER" }));

    expect(result).toEqual({ received: true });
    expect(tx.subscription.upsert).not.toHaveBeenCalled();
    expect(tx.processedWebhookEvent.create).toHaveBeenCalled();
  });

  it("a malformed payload (schema parse failure) acks without touching the transaction", async () => {
    const tx = buildTx();
    const prisma = { $transaction: jest.fn() } as unknown as PrismaService;
    const isolatedService = new RcWebhookService(prisma, buildAnalytics().analytics);

    const result = await isolatedService.handle({ not: "a valid envelope" });

    expect(result).toEqual({ received: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.processedWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("a genuine (non-P2002) error on the dedupe insert propagates (-> 500 -> RC retries)", async () => {
    const tx = buildTx({
      processedWebhookEvent: { create: jest.fn().mockRejectedValue(new Error("db down")) },
    });
    const { service } = buildService(tx);

    await expect(service.handle(buildEnvelope())).rejects.toThrow("db down");
  });

  it("a valid known-type event with a resolvable member upserts the mapped state", async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await service.handle(buildEnvelope());

    expect(tx.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { rcAppUserId: "user-1" },
        create: expect.objectContaining({
          rcAppUserId: "user-1",
          householdId: "household-1",
          entitlement: "PREMIUM",
          status: "active",
        }),
      }),
    );
  });

  describe("trial_start analytics emission (T078 plan)", () => {
    it("INITIAL_PURCHASE with period_type: 'TRIAL' + resolvable household emits trial_start once", async () => {
      const tx = buildTx();
      const { analytics, capture } = buildAnalytics();
      const { service } = buildService(tx, { analytics });

      await service.handle(
        buildEnvelope({ type: "INITIAL_PURCHASE", period_type: "TRIAL", product_id: "pawcareright_monthly" }),
      );

      expect(capture).toHaveBeenCalledTimes(1);
      expect(capture).toHaveBeenCalledWith("user-1", "trial_start", {
        householdId: "household-1",
        plan: "pawcareright_monthly",
      });
    });

    it("INITIAL_PURCHASE with period_type: 'NORMAL' does NOT emit", async () => {
      const tx = buildTx();
      const { analytics, capture } = buildAnalytics();
      const { service } = buildService(tx, { analytics });

      await service.handle(buildEnvelope({ type: "INITIAL_PURCHASE", period_type: "NORMAL" }));

      expect(capture).not.toHaveBeenCalled();
    });

    it("a duplicate replay of the trial event does NOT emit (dedupe short-circuit)", async () => {
      const tx = buildTx({
        processedWebhookEvent: { create: jest.fn().mockRejectedValue(p2002()) },
      });
      const { analytics, capture } = buildAnalytics();
      const { service } = buildService(tx, { analytics });

      await service.handle(buildEnvelope({ type: "INITIAL_PURCHASE", period_type: "TRIAL" }));

      expect(capture).not.toHaveBeenCalled();
    });

    it("RENEWAL does NOT emit trial_start even with period_type: 'TRIAL'", async () => {
      const tx = buildTx();
      const { analytics, capture } = buildAnalytics();
      const { service } = buildService(tx, { analytics });

      await service.handle(buildEnvelope({ type: "RENEWAL", period_type: "TRIAL" }));

      expect(capture).not.toHaveBeenCalled();
    });

    it("EXPIRATION does NOT emit trial_start", async () => {
      const tx = buildTx();
      const { analytics, capture } = buildAnalytics();
      const { service } = buildService(tx, { analytics });

      await service.handle(buildEnvelope({ type: "EXPIRATION", period_type: "TRIAL" }));

      expect(capture).not.toHaveBeenCalled();
    });
  });
});
