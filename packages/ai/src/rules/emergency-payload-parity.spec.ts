import { EMERGENCY_PAYLOADS, emergencyPayloadByKey, GENERIC_EMERGENCY_PAYLOAD, resolveEmergencyPayload } from "@pawcareright/data";

import { RED_FLAG_RULES } from "./rules-table";

/**
 * Cross-package completeness/parity test (T049 plan D5): the only cycle-free
 * home able to import both `RED_FLAG_RULES` (packages/ai) and the
 * `@pawcareright/data` emergency-payload content (ai -> data is already a
 * dependency; data -> ai would cycle). Would fail if a 23rd rule lands
 * without matching content.
 */
describe("emergency payload parity — every RED_FLAG_RULES key has content", () => {
  it.each(RED_FLAG_RULES)("$emergencyPayloadKey resolves to a non-generic payload", (rule) => {
    expect(emergencyPayloadByKey.has(rule.emergencyPayloadKey)).toBe(true);
    expect(resolveEmergencyPayload(rule.emergencyPayloadKey).key).toBe(rule.emergencyPayloadKey);
  });

  it("no orphan payloads (every EMERGENCY_PAYLOADS key maps to some rule)", () => {
    const ruleKeys = new Set(RED_FLAG_RULES.map((rule) => rule.emergencyPayloadKey));
    const orphans = EMERGENCY_PAYLOADS.filter((payload) => !ruleKeys.has(payload.key));
    expect(orphans).toEqual([]);
  });

  it("resolveEmergencyPayload fails upward to the generic payload for undefined/unknown keys", () => {
    expect(resolveEmergencyPayload(undefined)).toBe(GENERIC_EMERGENCY_PAYLOAD);
    expect(resolveEmergencyPayload("no-such-key")).toBe(GENERIC_EMERGENCY_PAYLOAD);
  });
});
