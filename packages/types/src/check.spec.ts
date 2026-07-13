import { checkResponseSchema, followUpResponseSchema } from "./check";
import { isTerminalCheckStatus } from "./check-status";
import type { TriageResult } from "./triage";

// T047 plan "Acceptance-criteria -> test mapping": `checkResponseSchema`
// round-trips a full server body and a minimal one, rejects an unknown
// status; `isTerminalCheckStatus` is true for DONE/FALLBACK, false for
// QUEUED/RUNNING.

const SAMPLE_RESULT: TriageResult = {
  urgency: "MONITOR",
  confidence: "high",
  summary: "General guidance based on the information provided.",
  possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
  redFlagsToWatch: ["Repeated vomiting"],
  homeCare: ["Offer small amounts of water"],
  doNot: ["Do not give human medications without veterinary guidance."],
  vetQuestions: ["How long have symptoms been present?"],
  followUpHours: 24,
};

describe("checkResponseSchema", () => {
  it("parses a full server body (with redFlag + result)", () => {
    const body = {
      id: "c1",
      status: "DONE",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
      redFlag: { ruleId: "rule-1", payloadKey: "payload-1" },
      result: SAMPLE_RESULT,
    };

    const parsed = checkResponseSchema.parse(body);
    expect(parsed).toEqual(body);
  });

  it("parses a minimal body (QUEUED, no redFlag/result)", () => {
    const body = {
      id: "c2",
      status: "QUEUED",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    const parsed = checkResponseSchema.parse(body);
    expect(parsed).toEqual(body);
    expect(parsed.redFlag).toBeUndefined();
    expect(parsed.result).toBeUndefined();
  });

  it("rejects an unknown status", () => {
    const body = {
      id: "c3",
      status: "CANCELLED",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
    };

    expect(checkResponseSchema.safeParse(body).success).toBe(false);
  });

  it("parses a body carrying followUp with an escalatedTier", () => {
    const body = {
      id: "c4",
      status: "DONE",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
      result: SAMPLE_RESULT,
      followUp: { response: "worse", escalatedTier: "VET_SOON" },
    };

    const parsed = checkResponseSchema.parse(body);
    expect(parsed).toEqual(body);
  });

  it("parses a body carrying followUp without an escalatedTier (better/same)", () => {
    const body = {
      id: "c5",
      status: "DONE",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
      result: SAMPLE_RESULT,
      followUp: { response: "better" },
    };

    const parsed = checkResponseSchema.parse(body);
    expect(parsed).toEqual(body);
    expect(parsed.followUp?.escalatedTier).toBeUndefined();
  });
});

describe("followUpResponseSchema", () => {
  it.each(["better", "same", "worse"] as const)("accepts %s", (value) => {
    expect(followUpResponseSchema.safeParse(value).success).toBe(true);
  });

  it.each(["Better", "worst", "", "SAME", 1])("rejects %p", (value) => {
    expect(followUpResponseSchema.safeParse(value).success).toBe(false);
  });
});

describe("isTerminalCheckStatus", () => {
  it.each(["DONE", "FALLBACK"] as const)("is true for %s", (status) => {
    expect(isTerminalCheckStatus(status)).toBe(true);
  });

  it.each(["QUEUED", "RUNNING"] as const)("is false for %s", (status) => {
    expect(isTerminalCheckStatus(status)).toBe(false);
  });
});
