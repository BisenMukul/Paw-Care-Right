/**
 * Deterministic repair re-prompt (T033). Given only `reason` (from a failed
 * `parseTriage`), produces a stable instruction to return corrected JSON —
 * consumed by `runTriage`'s single repair retry (plan R5, exactly one retry
 * before the frozen `SAFE_FALLBACK`).
 */
export function buildRepairPrompt(reason: string): string {
  return (
    `Your previous response was not valid TriageResult JSON. Problems: ${reason}. ` +
    "Return only corrected JSON that matches the schema exactly — no code fences, no text outside the JSON."
  );
}
