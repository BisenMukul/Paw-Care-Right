import {
  CHAT_FAIR_USE_MONTHLY_LIMIT,
  CHAT_SSE_EVENTS,
  chatChunkEventSchema,
  chatDoneEventSchema,
  chatNudgeEventSchema,
  chatSseEventSchema,
  chatStartEventSchema,
  chatThreadSchema,
  createChatThreadRequestSchema,
  sendChatMessageRequestSchema,
} from "./chat";

describe("createChatThreadRequestSchema", () => {
  it("accepts a valid petId", () => {
    expect(createChatThreadRequestSchema.safeParse({ petId: "11111111-1111-4111-8111-111111111111" }).success).toBe(
      true,
    );
  });

  it("rejects a non-uuid petId", () => {
    expect(createChatThreadRequestSchema.safeParse({ petId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("chatThreadSchema", () => {
  it("accepts a valid thread", () => {
    expect(
      chatThreadSchema.safeParse({ id: "t1", petId: "p1", createdAt: "2026-07-24T00:00:00.000Z" }).success,
    ).toBe(true);
  });

  it("rejects a missing id", () => {
    expect(chatThreadSchema.safeParse({ petId: "p1", createdAt: "2026-07-24T00:00:00.000Z" }).success).toBe(false);
  });
});

describe("sendChatMessageRequestSchema", () => {
  it("accepts valid content", () => {
    expect(sendChatMessageRequestSchema.safeParse({ content: "My dog is limping." }).success).toBe(true);
  });

  it("rejects empty content", () => {
    expect(sendChatMessageRequestSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects content over 2000 chars", () => {
    expect(sendChatMessageRequestSchema.safeParse({ content: "a".repeat(2001) }).success).toBe(false);
  });
});

describe("chatSseEventSchema", () => {
  it("accepts each of the four documented event names", () => {
    for (const name of CHAT_SSE_EVENTS) {
      expect(chatSseEventSchema.safeParse(name).success).toBe(true);
    }
  });

  it("rejects an unknown event name", () => {
    expect(chatSseEventSchema.safeParse("error").success).toBe(false);
  });
});

describe("chatStartEventSchema", () => {
  it("accepts a valid start payload", () => {
    expect(
      chatStartEventSchema.safeParse({ threadId: "t1", userMessageId: "u1", assistantMessageId: "a1" }).success,
    ).toBe(true);
  });

  it("rejects a payload missing assistantMessageId", () => {
    expect(chatStartEventSchema.safeParse({ threadId: "t1", userMessageId: "u1" }).success).toBe(false);
  });
});

describe("chatNudgeEventSchema", () => {
  it("accepts a valid symptom category", () => {
    expect(chatNudgeEventSchema.safeParse({ category: "vomiting" }).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(chatNudgeEventSchema.safeParse({ category: "not-a-category" }).success).toBe(false);
  });
});

describe("chatChunkEventSchema", () => {
  it("accepts seq 0 and positive text", () => {
    expect(chatChunkEventSchema.safeParse({ seq: 0, text: "hello" }).success).toBe(true);
  });

  it("rejects a negative seq", () => {
    expect(chatChunkEventSchema.safeParse({ seq: -1, text: "hello" }).success).toBe(false);
  });
});

describe("chatDoneEventSchema", () => {
  it("accepts a valid OK done payload", () => {
    expect(
      chatDoneEventSchema.safeParse({
        assistantMessageId: "a1",
        status: "OK",
        quota: { used: 3, limit: 200, remaining: 197 },
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(
      chatDoneEventSchema.safeParse({
        assistantMessageId: "a1",
        status: "ERROR",
        quota: { used: 3, limit: 200, remaining: 197 },
      }).success,
    ).toBe(false);
  });
});

describe("CHAT_FAIR_USE_MONTHLY_LIMIT", () => {
  it("is 200", () => {
    expect(CHAT_FAIR_USE_MONTHLY_LIMIT).toBe(200);
  });
});
