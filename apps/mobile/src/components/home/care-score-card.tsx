import type { Pet } from "@pawcareright/types";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

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
 * Home tab Care Score card (FIDELITY-1 plan, Variant-A placement; restyled
 * into the care-hub deep-green hero by FIDELITY-2 plan §D): fetches the
 * pet's trailing 7-day agenda window, computes the honest routine-
 * completeness score via `computeCareScore`, and renders the white-ring +
 * record-only copy (label/explainer/bucket line -- never a health/wellbeing
 * claim, see `fidelity1-strings-tone.test.ts`) on a `bg-accent-dark` hero
 * surface (`#1E6B54`, R4's AA-mandated substitute for the mockup's
 * `#2EA57C->#1E6B54` gradient -- white text on `#2EA57C` fails AA, verified
 * in `dual-theme-contrast.test.ts`'s mutation-proof). The surface is the
 * SAME green in both color schemes (matches `accent.dark`'s existing
 * both-themes usage elsewhere, e.g. `PrimaryButton`'s dark fill), so no
 * `dark:` class is needed here. While the agenda query is loading it
 * renders a benign spinner placeholder; an error, an offline miss, or a
 * genuinely empty window all fall through to the SAME honest "insufficient"
 * presentation (`entries` defaults to `[]`) rather than a distinct alarming
 * state -- this card never blocks or breaks the host screen. The "Run a
 * check" CTA is the one sliver of navigation logic in this otherwise
 * presentational batch (plan R5): it routes to the existing `/check` entry,
 * carrying this pet's id -- no new behavior.
 */
export function CareScoreCard({ pet }: CareScoreCardProps) {
  const router = useRouter();
  const now = new Date();
  const { from, to } = windowIso(now);
  const { data, isLoading } = useAgenda({ from, to, petId: pet.id });

  if (isLoading) {
    return (
      <View testID="home-care-score-card" className="gap-3 rounded-2xl bg-accent-dark px-4 py-4 shadow-md">
        <ActivityIndicator testID="home-care-score-loading" color="#ffffff" />
      </View>
    );
  }

  const entries = data?.entries ?? [];
  const result = computeCareScore({ entries, now });
  const value = result.kind === "score" ? result.value : null;

  return (
    <View
      testID="home-care-score-card"
      className="flex-row items-center gap-4 rounded-2xl bg-accent-dark px-4 py-4 shadow-md"
    >
      <View accessible accessibilityLabel={strings.careScore.a11yRing(pet.name)}>
        <CareScoreRing value={value} testID="home-care-score-ring" onDark />
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-white font-body-semibold">{strings.careScore.label}</Text>
        <Text className="text-sm text-white font-body">{strings.careScore.explainer(pet.name)}</Text>
        <Text testID="home-care-score-bucket" className="text-sm font-semibold text-white font-body-semibold">
          {careScoreBucketLine(result)}
        </Text>
        <Pressable
          testID="home-care-score-cta"
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/check", params: { petId: pet.id } })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
          className="mt-1 self-start rounded-lg bg-white px-4 py-2"
        >
          <Text className="text-sm font-semibold text-accent-dark font-body-semibold">
            {strings.careScore.runCheckCta}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
