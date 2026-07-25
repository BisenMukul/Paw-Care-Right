/**
 * `AiAuditEntry` input shape for `AiAuditService.record` (T090 plan step
 * 13). The discriminated union makes "both ids set" / "neither id set"
 * unrepresentable at the call site — that IS the exactly-one-of (`checkId`
 * XOR `threadId`) enforcement (plan D4): no SQL `CHECK` constraint is added
 * to the migration (would create schema.prisma <-> DB drift).
 */
export type AiAuditStatus = "OK" | "SAFE_FALLBACK";

interface AiAuditBase {
  promptVersion: string;
  modelId: string;
  detectorFlags: string[];
  costMicroUsd: number;
  latencyMs?: number;
  status: AiAuditStatus;
}

export type AiAuditEntry =
  | (AiAuditBase & { surface: "CHECK"; checkId: string })
  | (AiAuditBase & { surface: "CHAT"; threadId: string });
