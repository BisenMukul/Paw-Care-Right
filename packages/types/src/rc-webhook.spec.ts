import { RC_WEBHOOK_EVENT_TYPES, rcWebhookEnvelopeSchema, rcWebhookEventSchema } from "./rc-webhook";

function realisticEnvelope(overrides: Record<string, unknown> = {}): unknown {
  return {
    api_version: "1.0",
    event: {
      id: "evt_123",
      type: RC_WEBHOOK_EVENT_TYPES.INITIAL_PURCHASE,
      app_user_id: "user-1",
      product_id: "pawcareright_monthly",
      expiration_at_ms: 1_700_000_000_000,
      purchased_at_ms: 1_699_000_000_000,
      event_timestamp_ms: 1_699_000_000_500,
      environment: "PRODUCTION",
      store: "APP_STORE",
      // unknown/extra RC fields that must survive `.passthrough()`
      some_future_rc_field: "keep-me",
      subscriber_attributes: { $email: { value: "user@example.com" } },
      ...overrides,
    },
  };
}

describe("rcWebhookEnvelopeSchema", () => {
  it("parses a full realistic RC envelope", () => {
    const parsed = rcWebhookEnvelopeSchema.parse(realisticEnvelope());

    expect(parsed.event.id).toBe("evt_123");
    expect(parsed.event.type).toBe("INITIAL_PURCHASE");
    expect(parsed.event.app_user_id).toBe("user-1");
    expect(parsed.event.product_id).toBe("pawcareright_monthly");
    expect(parsed.event.expiration_at_ms).toBe(1_700_000_000_000);
    expect(parsed.event.environment).toBe("PRODUCTION");
  });

  it("preserves unknown fields via .passthrough()", () => {
    const parsed = rcWebhookEnvelopeSchema.parse(realisticEnvelope()) as Record<string, unknown> & {
      event: Record<string, unknown>;
    };

    expect(parsed.event.some_future_rc_field).toBe("keep-me");
    expect(parsed.event.subscriber_attributes).toEqual({ $email: { value: "user@example.com" } });
  });

  it("fails parse when the event is missing id", () => {
    const envelope = realisticEnvelope();
    const event = (envelope as { event: Record<string, unknown> }).event;
    delete event.id;

    expect(rcWebhookEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });

  it("fails parse when the event is missing type", () => {
    const envelope = realisticEnvelope();
    const event = (envelope as { event: Record<string, unknown> }).event;
    delete event.type;

    expect(rcWebhookEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });
});

describe("rcWebhookEventSchema period_type (T078)", () => {
  it("parses and round-trips period_type: 'TRIAL' through the envelope schema", () => {
    const parsed = rcWebhookEnvelopeSchema.parse(realisticEnvelope({ period_type: "TRIAL" }));

    expect(parsed.event.period_type).toBe("TRIAL");
  });

  it("period_type is optional -- absent is still valid", () => {
    const result = rcWebhookEventSchema.safeParse({ id: "evt_1", type: "RENEWAL" });

    expect(result.success).toBe(true);
    expect(result.success && result.data.period_type).toBeUndefined();
  });
});

describe("rcWebhookEventSchema numeric ms fields", () => {
  it("accepts valid numeric ms fields", () => {
    const result = rcWebhookEventSchema.safeParse({
      id: "evt_1",
      type: "RENEWAL",
      expiration_at_ms: 123,
      purchased_at_ms: 456,
      event_timestamp_ms: 789,
    });

    expect(result.success).toBe(true);
  });

  it("rejects non-numeric ms fields", () => {
    const result = rcWebhookEventSchema.safeParse({
      id: "evt_1",
      type: "RENEWAL",
      expiration_at_ms: "not-a-number",
    });

    expect(result.success).toBe(false);
  });

  it("allows nullish ms fields (nullable and optional)", () => {
    const result = rcWebhookEventSchema.safeParse({
      id: "evt_1",
      type: "RENEWAL",
      expiration_at_ms: null,
    });

    expect(result.success).toBe(true);
  });
});
