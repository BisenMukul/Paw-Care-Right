import {
  activityValueSchema,
  checkRefValueSchema,
  mealValueSchema,
  medGivenValueSchema,
  noteValueSchema,
  vetVisitValueSchema,
  weightValueSchema,
  type ActivityValue,
} from "@pawcareright/types";

import type { TimelineItem } from "../api/health-logs-api";
import { strings } from "../strings";

/** "Fed · 2 meals" style, record-only (CLAUDE §7) -- never appends `note`, mirrors every other kind's single-fact summary line. */
function summarizeActivityValue(value: ActivityValue): string {
  const parts: string[] = [strings.activity.summaryVerb[value.activityType]];

  if (value.unit !== undefined) {
    const singular = strings.activity.unitLabelSingular[value.unit];
    const label = value.quantity === 1 && singular !== undefined ? singular : strings.activity.unitLabel[value.unit];
    parts.push(value.quantity !== undefined ? `${value.quantity} ${label}` : label);
  } else if (value.quantity !== undefined) {
    parts.push(String(value.quantity));
  }

  return parts.join(" · ");
}

/**
 * Record-only value summaries (T067 plan "Create" list). CLAUDE §7 rule 2 /
 * plan Safety statement: every string below is either a verbatim field from
 * the entry ("as entered") or a neutral record label — nothing here
 * computes, suggests, or formats a dose. Returns `null` when there is
 * nothing safe/parseable to show (never throws).
 */
export function summarizeTimelineValue(item: TimelineItem): string | null {
  switch (item.kind) {
    case "WEIGHT": {
      const parsed = weightValueSchema.safeParse(item.value);
      return parsed.success ? `${parsed.data.weightGrams} g` : null;
    }
    case "MEAL": {
      const parsed = mealValueSchema.safeParse(item.value);
      return parsed.success ? parsed.data.note : null;
    }
    case "NOTE": {
      const parsed = noteValueSchema.safeParse(item.value);
      return parsed.success ? parsed.data.text : null;
    }
    case "VET_VISIT": {
      const parsed = vetVisitValueSchema.safeParse(item.value);
      return parsed.success ? parsed.data.reason : null;
    }
    case "MED_GIVEN": {
      const parsed = medGivenValueSchema.safeParse(item.value);
      if (!parsed.success) {
        return strings.timeline.medGivenFallback;
      }
      const { medNameAsEntered, medDoseAsEntered } = parsed.data;
      const parts = [medNameAsEntered, medDoseAsEntered].filter(
        (part): part is string => part !== undefined,
      );
      return parts.length > 0 ? parts.join(" — ") : strings.timeline.medGivenFallback;
    }
    case "CHECK_REF": {
      const parsed = checkRefValueSchema.safeParse(item.value);
      return parsed.success ? strings.timeline.kindLabel.CHECK_REF : null;
    }
    case "ACTIVITY": {
      const parsed = activityValueSchema.safeParse(item.value);
      return parsed.success ? summarizeActivityValue(parsed.data) : null;
    }
    default:
      return null;
  }
}

/** Returns the well-formed `checkId` for a CHECK_REF row, else `null` (never throws). */
export function extractCheckRefId(item: TimelineItem): string | null {
  if (item.kind !== "CHECK_REF") {
    return null;
  }
  const parsed = checkRefValueSchema.safeParse(item.value);
  return parsed.success ? parsed.data.checkId : null;
}
