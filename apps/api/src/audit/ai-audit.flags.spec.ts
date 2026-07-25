import type { ChatSafetyIncident } from "@pawcareright/ai";

import {
  AI_AUDIT_FLAG_CODES,
  buildCheckDetectorFlags,
  CHAT_INCIDENT_PHASE_CODES,
  CHAT_INCIDENT_REASON_CODES,
  buildChatDetectorFlags,
  type BuildCheckDetectorFlagsInput,
} from "./ai-audit.flags";

const STATUSES: BuildCheckDetectorFlagsInput["status"][] = ["OK", "REPAIRED", "SAFE_FALLBACK"];
const SOURCES: BuildCheckDetectorFlagsInput["source"][] = ["rules", "ai"];
const BOOLEANS = [true, false];

function buildIncident(overrides: Partial<ChatSafetyIncident> = {}): ChatSafetyIncident {
  return {
    reason: "detector_finding",
    codes: ["DOSING"],
    phase: "release",
    charsScanned: 10,
    releasedChars: 5,
    releasedBeforeFlag: true,
    ...overrides,
  };
}

describe("buildCheckDetectorFlags", () => {
  it("every produced flag is a code from the closed set (sweep over all combinations)", () => {
    for (const status of STATUSES) {
      for (const source of SOURCES) {
        for (const appliedRulesFloor of BOOLEANS) {
          for (const redFlagHit of BOOLEANS) {
            const flags = buildCheckDetectorFlags({ status, source, appliedRulesFloor, redFlagHit });
            for (const flag of flags) {
              expect(AI_AUDIT_FLAG_CODES).toContain(flag);
            }
          }
        }
      }
    }
  });

  it("includes source:<source> always, rules_floor_applied and red_flag_hit only when true", () => {
    expect(buildCheckDetectorFlags({ status: "OK", source: "ai", appliedRulesFloor: false, redFlagHit: false })).toEqual([
      "source:ai",
    ]);
    expect(
      buildCheckDetectorFlags({ status: "SAFE_FALLBACK", source: "rules", appliedRulesFloor: true, redFlagHit: true }),
    ).toEqual(["source:rules", "rules_floor_applied", "red_flag_hit"]);
  });

  it("never returns free text: a planted long failureReason on the input is never touched", () => {
    // `failureReason` is NOT part of `BuildCheckDetectorFlagsInput` -- passed
    // via a variable (not an object literal) to bypass TS's excess-property
    // check and prove the implementation never reaches for it structurally.
    const plantedSentence =
      "A very long, arbitrary, free-text failure reason sentence that must never leak into an audit flag.";
    const input = {
      status: "SAFE_FALLBACK" as const,
      source: "ai" as const,
      appliedRulesFloor: false,
      redFlagHit: false,
      failureReason: plantedSentence,
    };

    const flags = buildCheckDetectorFlags(input);
    for (const flag of flags) {
      expect(flag).not.toContain(plantedSentence);
      expect(flag.length).toBeLessThanOrEqual(32);
    }
  });
});

describe("buildChatDetectorFlags", () => {
  it("returns [] when there is no incident", () => {
    expect(buildChatDetectorFlags(undefined)).toEqual([]);
  });

  it("every produced flag is a code from the closed set (sweep over reason x phase)", () => {
    for (const reason of CHAT_INCIDENT_REASON_CODES) {
      for (const phase of CHAT_INCIDENT_PHASE_CODES) {
        const incident = buildIncident({ reason, phase, codes: ["DOSING"] });
        const flags = buildChatDetectorFlags(incident);
        for (const flag of flags) {
          expect(AI_AUDIT_FLAG_CODES).toContain(flag);
        }
        expect(flags).toEqual([`reason:${reason}`, `phase:${phase}`, "DOSING"]);
      }
    }
  });

  it("never returns free text: enumerated codes pass through unchanged, no excerpt is ever synthesized", () => {
    const incident = buildIncident({ codes: ["HARM_ENABLING", "DIAGNOSIS_LANGUAGE"] });
    const flags = buildChatDetectorFlags(incident);
    expect(flags).toEqual(["reason:detector_finding", "phase:release", "HARM_ENABLING", "DIAGNOSIS_LANGUAGE"]);
    for (const flag of flags) {
      expect(flag.length).toBeLessThanOrEqual(32);
    }
  });
});
