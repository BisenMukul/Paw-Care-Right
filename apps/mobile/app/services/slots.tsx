import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Card } from "../../src/components/card";
import { Chip } from "../../src/components/chip";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { PREVIEW_SALONS, PREVIEW_SLOT_DAYS, PREVIEW_SLOT_TIMES, PREVIEW_VETS } from "../../src/services/preview-fixtures";
import { strings } from "../../src/strings";

type SlotKind = "vet" | "salon";

function resolveSummary(kind: SlotKind, id: string | undefined): { title: string; subtitle: string } {
  if (kind === "salon") {
    const salon = PREVIEW_SALONS.find((s) => s.id === id);
    return salon
      ? { title: salon.name, subtitle: salon.detail }
      : { title: strings.servicesPreview.salons.title, subtitle: strings.servicesPreview.salons.subtitle };
  }

  const vet = PREVIEW_VETS.find((v) => v.id === id);
  return vet
    ? { title: vet.name, subtitle: `${vet.specialty} · ${vet.experience}` }
    : { title: strings.servicesPreview.vets.title, subtitle: strings.servicesPreview.vets.subtitle };
}

/**
 * SLOT PICKER (PREVIEW-1 plan D3): reads `kind`/`id` from the vet or salon
 * list screen, shows a static summary card plus sample relative-day/time
 * chips (`PREVIEW_SLOT_DAYS`/`PREVIEW_SLOT_TIMES` -- no real calendar), and
 * the one confirm CTA lands on the single shared honest terminal.
 */
export default function ServicesSlotsScreen() {
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const [dayIndex, setDayIndex] = useState(0);
  const [timeIndex, setTimeIndex] = useState(0);

  const resolvedKind: SlotKind = kind === "salon" ? "salon" : "vet";
  const summary = resolveSummary(resolvedKind, id);

  return (
    <View testID="services-slots-screen" className="flex-1">
      <ScreenScaffold
        title={strings.servicesPreview.slots.title}
        footer={
          <PrimaryButton
            testID="services-slots-confirm"
            label={strings.servicesPreview.slots.cta}
            onPress={() => router.push({ pathname: "/services/preview-end", params: { service: resolvedKind } })}
          />
        }
      >
        <PreviewBanner />

        <Card accessibilityLabel={strings.servicesPreview.slots.summaryA11y}>
          <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {summary.title}
          </Text>
          <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{summary.subtitle}</Text>
          <View className="self-start rounded-full bg-brand-100 dark:bg-surface-card-dark px-3 py-1">
            <Text
              maxFontSizeMultiplier={1.5}
              className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
            >
              {strings.servicesPreview.slots.sampleTag}
            </Text>
          </View>
        </Card>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {strings.servicesPreview.slots.selectDay}
          </Text>
          <ScrollView horizontal contentContainerClassName="gap-2">
            {PREVIEW_SLOT_DAYS.map((day, i) => (
              <Chip
                key={day}
                testID={`services-slots-day-${i}`}
                label={day}
                selected={dayIndex === i}
                onPress={() => setDayIndex(i)}
              />
            ))}
          </ScrollView>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {strings.servicesPreview.slots.availableTimes}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {PREVIEW_SLOT_TIMES.map((time, i) => (
              <Chip
                key={time}
                testID={`services-slots-time-${i}`}
                label={time}
                selected={timeIndex === i}
                onPress={() => setTimeIndex(i)}
              />
            ))}
          </View>
        </View>
      </ScreenScaffold>
    </View>
  );
}
