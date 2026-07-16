import type { RcWebhookEvent } from "@pawcareright/types";

import { computeSubscriptionUpdate, RC_WEBHOOK_STATUS, resolveEventTimestampMs } from "./rc-webhook.state";

const RECEIVED_NOW = new Date("2026-07-16T12:00:00.000Z");

function buildEvent(overrides: Partial<RcWebhookEvent> = {}): RcWebhookEvent {
  return {
    id: "evt_1",
    type: "INITIAL_PURCHASE",
    app_user_id: "user-1",
    product_id: "pawcareright_monthly",
    expiration_at_ms: Date.parse("2026-08-16T12:00:00.000Z"),
    purchased_at_ms: Date.parse("2026-07-16T11:00:00.000Z"),
    event_timestamp_ms: Date.parse("2026-07-16T11:00:00.000Z"),
    environment: "PRODUCTION",
    store: "APP_STORE",
    ...overrides,
  };
}

describe("computeSubscriptionUpdate — table-driven per event type", () => {
  const cases: Array<{
    type: string;
    expectedEntitlement: "FREE" | "PREMIUM";
    expectedStatus: string;
  }> = [
    { type: "INITIAL_PURCHASE", expectedEntitlement: "PREMIUM", expectedStatus: RC_WEBHOOK_STATUS.ACTIVE },
    { type: "RENEWAL", expectedEntitlement: "PREMIUM", expectedStatus: RC_WEBHOOK_STATUS.ACTIVE },
    { type: "PRODUCT_CHANGE", expectedEntitlement: "PREMIUM", expectedStatus: RC_WEBHOOK_STATUS.ACTIVE },
    { type: "CANCELLATION", expectedEntitlement: "PREMIUM", expectedStatus: RC_WEBHOOK_STATUS.CANCELLED },
    { type: "BILLING_ISSUE", expectedEntitlement: "PREMIUM", expectedStatus: RC_WEBHOOK_STATUS.BILLING_ISSUE },
    { type: "EXPIRATION", expectedEntitlement: "FREE", expectedStatus: RC_WEBHOOK_STATUS.EXPIRED },
  ];

  it.each(cases)("$type -> $expectedEntitlement/$expectedStatus", ({ type, expectedEntitlement, expectedStatus }) => {
    const event = buildEvent({ type });

    const result = computeSubscriptionUpdate(event, null, RECEIVED_NOW);

    expect(result.action).toBe("upsert");
    if (result.action !== "upsert") {
      throw new Error("expected upsert");
    }
    expect(result.data.entitlement).toBe(expectedEntitlement);
    expect(result.data.status).toBe(expectedStatus);
    expect(result.data.expiresAt).toEqual(new Date(event.expiration_at_ms!));
    expect(result.data.lastEventAt).toEqual(new Date(event.event_timestamp_ms!));
  });

  it("RENEWAL sets a new expiresAt from the event", () => {
    const newExpiry = Date.parse("2026-09-16T12:00:00.000Z");
    const event = buildEvent({ type: "RENEWAL", expiration_at_ms: newExpiry });

    const result = computeSubscriptionUpdate(event, null, RECEIVED_NOW);

    expect(result.action).toBe("upsert");
    if (result.action !== "upsert") throw new Error("expected upsert");
    expect(result.data.expiresAt).toEqual(new Date(newExpiry));
  });

  it("PRODUCT_CHANGE carries the new plan (product_id)", () => {
    const event = buildEvent({ type: "PRODUCT_CHANGE", product_id: "pawcareright_family_annual" });

    const result = computeSubscriptionUpdate(event, null, RECEIVED_NOW);

    expect(result.action).toBe("upsert");
    if (result.action !== "upsert") throw new Error("expected upsert");
    expect(result.data.plan).toBe("pawcareright_family_annual");
  });

  it("CANCELLATION keeps entitlement PREMIUM (clock handles eventual expiry)", () => {
    const event = buildEvent({ type: "CANCELLATION" });

    const result = computeSubscriptionUpdate(event, null, RECEIVED_NOW);

    expect(result.action).toBe("upsert");
    if (result.action !== "upsert") throw new Error("expected upsert");
    expect(result.data.entitlement).toBe("PREMIUM");
    expect(result.data.status).toBe(RC_WEBHOOK_STATUS.CANCELLED);
  });

  it("unknown event type -> skip:unknown_type", () => {
    const event = buildEvent({ type: "TRANSFER" });

    const result = computeSubscriptionUpdate(event, null, RECEIVED_NOW);

    expect(result).toEqual({ action: "skip", reason: "unknown_type" });
  });
});

describe("computeSubscriptionUpdate — out-of-order delivery", () => {
  it("EXPIRATION applied, then an older-ts RENEWAL is stale (stays expired)", () => {
    const expirationEvent = buildEvent({
      type: "EXPIRATION",
      event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
    });
    const expirationResult = computeSubscriptionUpdate(expirationEvent, null, RECEIVED_NOW);
    expect(expirationResult.action).toBe("upsert");
    if (expirationResult.action !== "upsert") throw new Error("expected upsert");

    const olderRenewal = buildEvent({
      type: "RENEWAL",
      event_timestamp_ms: Date.parse("2026-07-16T10:00:00.000Z"),
    });
    const renewalResult = computeSubscriptionUpdate(
      olderRenewal,
      { lastEventAt: expirationResult.data.lastEventAt },
      RECEIVED_NOW,
    );

    expect(renewalResult).toEqual({ action: "skip", reason: "stale" });
  });

  it("RENEWAL applied, then an older-ts CANCELLATION is stale", () => {
    const renewalEvent = buildEvent({
      type: "RENEWAL",
      event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z"),
    });
    const renewalResult = computeSubscriptionUpdate(renewalEvent, null, RECEIVED_NOW);
    expect(renewalResult.action).toBe("upsert");
    if (renewalResult.action !== "upsert") throw new Error("expected upsert");

    const olderCancellation = buildEvent({
      type: "CANCELLATION",
      event_timestamp_ms: Date.parse("2026-07-16T09:00:00.000Z"),
    });
    const cancellationResult = computeSubscriptionUpdate(
      olderCancellation,
      { lastEventAt: renewalResult.data.lastEventAt },
      RECEIVED_NOW,
    );

    expect(cancellationResult).toEqual({ action: "skip", reason: "stale" });
  });

  it("a strictly-newer event is NOT skipped even when it is an otherwise-unknown type ordering doesn't matter", () => {
    // Stale gate runs first regardless of type; a newer event of a known type after a
    // stale one proceeds normally (sanity check that the gate isn't overzealous).
    const first = buildEvent({ type: "RENEWAL", event_timestamp_ms: Date.parse("2026-07-16T09:00:00.000Z") });
    const firstResult = computeSubscriptionUpdate(first, null, RECEIVED_NOW);
    expect(firstResult.action).toBe("upsert");
    if (firstResult.action !== "upsert") throw new Error("expected upsert");

    const newer = buildEvent({ type: "RENEWAL", event_timestamp_ms: Date.parse("2026-07-16T10:00:00.000Z") });
    const newerResult = computeSubscriptionUpdate(newer, { lastEventAt: firstResult.data.lastEventAt }, RECEIVED_NOW);

    expect(newerResult.action).toBe("upsert");
  });

  it("equal timestamps are applied (not strictly older -> not stale)", () => {
    const ts = Date.parse("2026-07-16T09:00:00.000Z");
    const first = buildEvent({ type: "RENEWAL", event_timestamp_ms: ts });
    const firstResult = computeSubscriptionUpdate(first, null, RECEIVED_NOW);
    expect(firstResult.action).toBe("upsert");
    if (firstResult.action !== "upsert") throw new Error("expected upsert");

    const second = buildEvent({ type: "CANCELLATION", event_timestamp_ms: ts });
    const secondResult = computeSubscriptionUpdate(
      second,
      { lastEventAt: firstResult.data.lastEventAt },
      RECEIVED_NOW,
    );

    expect(secondResult.action).toBe("upsert");
  });

  it("stale gate takes priority over unknown_type", () => {
    const first = buildEvent({ type: "RENEWAL", event_timestamp_ms: Date.parse("2026-07-16T12:00:00.000Z") });
    const firstResult = computeSubscriptionUpdate(first, null, RECEIVED_NOW);
    expect(firstResult.action).toBe("upsert");
    if (firstResult.action !== "upsert") throw new Error("expected upsert");

    const olderUnknown = buildEvent({ type: "TRANSFER", event_timestamp_ms: Date.parse("2026-07-16T09:00:00.000Z") });
    const result = computeSubscriptionUpdate(olderUnknown, { lastEventAt: firstResult.data.lastEventAt }, RECEIVED_NOW);

    expect(result).toEqual({ action: "skip", reason: "stale" });
  });
});

describe("resolveEventTimestampMs", () => {
  it("prefers event_timestamp_ms", () => {
    const event = buildEvent({ event_timestamp_ms: 100, purchased_at_ms: 200 });
    expect(resolveEventTimestampMs(event, 300)).toBe(100);
  });

  it("falls back to purchased_at_ms when event_timestamp_ms is absent", () => {
    const event = buildEvent({ event_timestamp_ms: null, purchased_at_ms: 200 });
    expect(resolveEventTimestampMs(event, 300)).toBe(200);
  });

  it("falls back to receivedNowMs when neither timestamp is present", () => {
    const event = buildEvent({ event_timestamp_ms: null, purchased_at_ms: null });
    expect(resolveEventTimestampMs(event, 300)).toBe(300);
  });
});
