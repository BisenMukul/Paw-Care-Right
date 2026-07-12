import { CONFIDENCE_LEVELS, URGENCY_TIERS } from "@pawcareright/types";

/**
 * `TriageResult` rendered as model-facing text (T033). The two enum lists
 * are interpolated from `URGENCY_TIERS`/`CONFIDENCE_LEVELS` so they cannot
 * drift from `@pawcareright/types`; the rest of the shape is static
 * descriptive text mirroring `triageResultSchema` (plan R1). `parseTriage`
 * remains the real validation gate — this text is a teaching aid, not a
 * schema serializer.
 */
export const TRIAGE_SCHEMA_TEXT = `{
  "urgency": <one of: ${URGENCY_TIERS.join(" | ")}>,
  "confidence": <one of: ${CONFIDENCE_LEVELS.join(" | ")}>,
  "summary": string (1-2 plain-language sentences),
  "possibleCauses": array (max 4) of { "name": string, "whyItFits": string },
  "redFlagsToWatch": string[],
  "homeCare": string[] (ONLY for VET_SOON/MONITOR/REASSURE; otherwise []),
  "doNot": string[],
  "vetQuestions": string[],
  "followUpHours": integer > 0, or null
}`;
