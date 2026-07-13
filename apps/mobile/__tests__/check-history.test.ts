import { SAFE_FALLBACK, type CheckResponse } from "@pawcareright/types";

import { deriveCheckChip, formatCheckDate, getCategoryLabel } from "../src/checks/check-history";

// T050 plan "Tests to write" -> "Chips (tier/status)" (pure). Covers the
// fail-upward precedence table: red-flag always wins to EMERGENCY_NOW
// regardless of status; a result's own urgency otherwise; SAFE_FALLBACK's
// VET_SOON for a terminal check with no valid result / FALLBACK; a neutral
// "in-progress" status chip for a still-running/queued, non-red-flag check.
describe("deriveCheckChip (pure)", () => {
  it("returns the EMERGENCY_NOW tier when redFlag is present, even while RUNNING", () => {
    const item = {
      id: "c1",
      status: "RUNNING",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
      redFlag: { ruleId: "rule-1", payloadKey: "vomiting.blood" },
    } as CheckResponse;

    expect(deriveCheckChip(item)).toEqual({ kind: "tier", urgency: "EMERGENCY_NOW" });
  });

  it("returns the result's own urgency for a DONE check with a result", () => {
    const item = {
      id: "c2",
      status: "DONE",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
      result: { urgency: "MONITOR" },
    } as unknown as CheckResponse;

    expect(deriveCheckChip(item)).toEqual({ kind: "tier", urgency: "MONITOR" });
  });

  it("returns SAFE_FALLBACK.urgency (VET_SOON) for a FALLBACK check with no result", () => {
    const item = {
      id: "c3",
      status: "FALLBACK",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
    } as CheckResponse;

    expect(deriveCheckChip(item)).toEqual({ kind: "tier", urgency: SAFE_FALLBACK.urgency });
    expect(SAFE_FALLBACK.urgency).toBe("VET_SOON");
  });

  it("returns SAFE_FALLBACK.urgency (VET_SOON) for a DONE check missing its result (defensive)", () => {
    const item = {
      id: "c4",
      status: "DONE",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
    } as CheckResponse;

    expect(deriveCheckChip(item)).toEqual({ kind: "tier", urgency: SAFE_FALLBACK.urgency });
  });

  it("returns the neutral in-progress status chip for a QUEUED, non-red-flag check", () => {
    const item = {
      id: "c5",
      status: "QUEUED",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
    } as CheckResponse;

    expect(deriveCheckChip(item)).toEqual({ kind: "status", status: "in-progress" });
  });
});

describe("getCategoryLabel (pure)", () => {
  it("maps a known category id to its human label", () => {
    expect(getCategoryLabel("vomiting")).toBe("Vomiting");
  });

  it("falls back to the raw string for an unknown id", () => {
    expect(getCategoryLabel("not-a-real-category")).toBe("not-a-real-category");
  });
});

describe("formatCheckDate (pure)", () => {
  it("formats an ISO timestamp as locale-free YYYY-MM-DD", () => {
    expect(formatCheckDate("2024-01-01T00:00:00.000Z")).toBe("2024-01-01");
  });
});
