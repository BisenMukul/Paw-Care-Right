import type { Pet } from "@pawcareright/types";
import { ActivityIndicator, Text, View } from "react-native";

import { useAgenda } from "../../api/agenda-api";
import { CARE_SCORE_WINDOW_DAYS, careScoreBucketLine, computeCareScore } from "../../care/care-score";
import { strings } from "../../strings";
import { CareScoreRing } from "./care-score-ring";

export interface CareScoreCardProps {
  pet: Pet;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function windowIso(now: Date): { from: string; to: string } {
  const from = new Date(startOfDay(now).getTime() - (CARE_SCORE_WINDOW_DAYS - 1) * DAY_MS);
  return { from: from.toISOString(), to: now.toISOString() };
}

/**
 * Home tab Care Score card (FIDELITY-1 plan, Variant-A placement): fetches
 * the pet's trailing 7-day agenda window, computes the honest routine-
 * completeness score via `computeCareScore`, and renders the ring + record-
 * only copy (label/explainer/bucket line -- never a health/wellbeing claim,
 * see `fidelity1-strings-tone.test.ts`). While the agenda query is loading
 * it renders a benign spinner placeholder; an error, an offline miss, or a
 * genuinely empty window all fall through to the SAME honest "insufficient"
 * presentation (`entries` defaults to `[]`) rather than a distinct alarming
 * state -- this card never blocks or breaks the host screen.
 */
export function CareScoreCard({ pet }: CareScoreCardProps) {
  const now = new Date();
  const { from, to } = windowIso(now);
  const { data, isLoading } = useAgenda({ from, to, petId: pet.id });

  if (isLoading) {
    return (
      <View
        testID="home-care-score-card"
        className="gap-3 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-4 shadow-md"
      >
        <ActivityIndicator testID="home-care-score-loading" />
      </View>
    );
  }

  const entries = data?.entries ?? [];
  const result = computeCareScore({ entries, now });
  const value = result.kind === "score" ? result.value : null;

  return (
    <View
      testID="home-care-score-card"
      className="flex-row items-center gap-4 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-4 shadow-md"
    >
      <View accessible accessibilityLabel={strings.careScore.a11yRing(pet.name)}>
        <CareScoreRing value={value} testID="home-care-score-ring" />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.careScore.label}
        </Text>
        <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.careScore.explainer(pet.name)}
        </Text>
        <Text
          testID="home-care-score-bucket"
          className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold"
        >
          {careScoreBucketLine(result)}
        </Text>
      </View>
    </View>
  );
}
