import type { BreedGuide } from "@bombaypetcompany/data";
import { Text, View } from "react-native";

import { strings } from "../strings";

export interface BreedGuideSectionsProps {
  guide: BreedGuide;
}

const SECTION_CONTAINER_CLASS =
  "gap-2 rounded-2xl bg-surface-card dark:bg-surface-card-dark border border-brand-100 dark:border-hairline-dark p-4";
const SECTION_TITLE_CLASS = "text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold";
const NARRATIVE_CLASS = "text-base text-brand-700 dark:text-ink-muted-dark font-body";
const CHIP_CLASS = "self-start rounded-full bg-brand-100 dark:bg-surface-raised-dark px-3 py-1";
const CHIP_TEXT_CLASS = "text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold";

/**
 * T087 plan (D1) — the "markdown-ish" renderer. NOT a markdown engine: T084
 * D6 fixed the content model as four typed fields with no free-form
 * markdown body anywhere in the dataset, so this maps each typed field to a
 * titled section instead of adding a parsing dependency (CLAUDE §2 rule 7).
 * Presentational only — no navigation, no data access. The
 * condition-awareness `prompt` values render VERBATIM: never truncated,
 * never reworded, never merged with `topic` (safety statement 3).
 */
export function BreedGuideSections({ guide }: BreedGuideSectionsProps) {
  const { temperament, exerciseNeeds, commonConditionAwareness, groomingCadence, provenance } = guide;
  const { reviewedBy, reviewedAt } = provenance;

  return (
    <View testID="breed-guide-sections" className="gap-3">
      <View
        testID="breed-guide-section-temperament"
        accessibilityLabel={strings.breedGuide.sectionA11y(strings.breedGuide.sections.temperament)}
        className={SECTION_CONTAINER_CLASS}
      >
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} className={SECTION_TITLE_CLASS}>
          {strings.breedGuide.sections.temperament}
        </Text>
        <Text className={NARRATIVE_CLASS}>{temperament}</Text>
      </View>

      <View
        testID="breed-guide-section-exercise"
        accessibilityLabel={strings.breedGuide.sectionA11y(strings.breedGuide.sections.exercise)}
        className={SECTION_CONTAINER_CLASS}
      >
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} className={SECTION_TITLE_CLASS}>
          {strings.breedGuide.sections.exercise}
        </Text>
        <View testID="breed-guide-exercise-level" className={CHIP_CLASS}>
          <Text maxFontSizeMultiplier={1.5} className={CHIP_TEXT_CLASS}>
            {strings.breedGuide.exerciseLevel[exerciseNeeds.level]}
          </Text>
        </View>
        <Text className={NARRATIVE_CLASS}>{exerciseNeeds.narrative}</Text>
      </View>

      <View
        testID="breed-guide-section-conditions"
        accessibilityLabel={strings.breedGuide.sectionA11y(strings.breedGuide.sections.conditions)}
        className={SECTION_CONTAINER_CLASS}
      >
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} className={SECTION_TITLE_CLASS}>
          {strings.breedGuide.sections.conditions}
        </Text>
        <Text className={NARRATIVE_CLASS}>{strings.breedGuide.conditionsIntro}</Text>
        {commonConditionAwareness.map((item, index) => (
          <View key={item.topic} testID={`breed-guide-condition-${index}`} className="gap-1">
            <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
              {item.topic}
            </Text>
            <Text className={NARRATIVE_CLASS}>{item.prompt}</Text>
          </View>
        ))}
      </View>

      <View
        testID="breed-guide-section-grooming"
        accessibilityLabel={strings.breedGuide.sectionA11y(strings.breedGuide.sections.grooming)}
        className={SECTION_CONTAINER_CLASS}
      >
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} className={SECTION_TITLE_CLASS}>
          {strings.breedGuide.sections.grooming}
        </Text>
        <View testID="breed-guide-grooming-frequency" className={CHIP_CLASS}>
          <Text maxFontSizeMultiplier={1.5} className={CHIP_TEXT_CLASS}>
            {strings.breedGuide.groomingFrequency[groomingCadence.frequency]}
          </Text>
        </View>
        <Text className={NARRATIVE_CLASS}>{groomingCadence.narrative}</Text>
      </View>

      {reviewedBy !== undefined && reviewedAt !== undefined ? (
        <Text testID="breed-guide-provenance" className="text-xs text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.breedGuide.provenance(reviewedBy, reviewedAt)}
        </Text>
      ) : null}
    </View>
  );
}
