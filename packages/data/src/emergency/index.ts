import { EMERGENCY_PAYLOAD_ROWS, GENERIC_EMERGENCY_PAYLOAD_ROW } from "./data";
import { emergencyPayloadSchema, type EmergencyPayload } from "./schema";

// Parsing at module load is the runtime validation layer; `emergency-payloads.spec.ts`
// is the build/test-time layer that additionally asserts counts/uniqueness
// (mirrors packages/data/src/toxins/index.ts).
export const EMERGENCY_PAYLOADS: readonly EmergencyPayload[] = Object.freeze(
  EMERGENCY_PAYLOAD_ROWS.map((row) => emergencyPayloadSchema.parse(row)),
);

export const GENERIC_EMERGENCY_PAYLOAD: EmergencyPayload = Object.freeze(
  emergencyPayloadSchema.parse(GENERIC_EMERGENCY_PAYLOAD_ROW),
);

export const emergencyPayloadByKey: ReadonlyMap<string, EmergencyPayload> = new Map(
  EMERGENCY_PAYLOADS.map((row) => [row.key, row]),
);

/** Fail-upward (T049 plan §5 rule 2 / R6): unknown/missing key -> the generic emergency payload. */
export function resolveEmergencyPayload(key?: string): EmergencyPayload {
  return (key ? emergencyPayloadByKey.get(key) : undefined) ?? GENERIC_EMERGENCY_PAYLOAD;
}
