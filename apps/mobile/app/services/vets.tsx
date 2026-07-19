import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Card } from "../../src/components/card";
import { Chip } from "../../src/components/chip";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { useReducedMotion } from "../../src/hooks/use-reduced-motion";
import { PREVIEW_VETS, PREVIEW_VET_MODES, type PreviewVetMode } from "../../src/services/preview-fixtures";
import { strings } from "../../src/strings";

const DEFAULT_MODE: PreviewVetMode = PREVIEW_VET_MODES[0]?.key ?? "video";

/**
 * VET LIST (PREVIEW-1 plan): sample vets only, static local fixtures. The
 * mode chips (video/clinic/home) are presentational filters -- selecting
 * one doesn't change the (identical) fixture list, matching the mockup's
 * layout without inventing per-mode data this batch doesn't have. Each
 * card's "Preview booking" button carries the vet's id into the shared
 * slot picker (D3).
 */
export default function ServicesVetsScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<PreviewVetMode>(DEFAULT_MODE);

  return (
    <View testID="services-vets-screen" className="flex-1">
      <ScreenScaffold title={strings.servicesPreview.vets.title} subtitle={strings.servicesPreview.vets.subtitle}>
        <PreviewBanner />

        <View className="flex-row flex-wrap gap-2">
          {PREVIEW_VET_MODES.map((m) => (
            <Chip
              key={m.key}
              testID={`services-vet-mode-${m.key}`}
              label={m.label}
              selected={mode === m.key}
              onPress={() => setMode(m.key)}
            />
          ))}
        </View>

        <View className="gap-3">
          {PREVIEW_VETS.map((vet, i) => (
            <Animated.View key={vet.id} {...(reduced ? {} : { entering: FadeInDown.delay(i * 80).duration(320) })}>
              <Card testID={`services-vet-card-${vet.id}`}>
                <View className="flex-row gap-3">
                  <View
                    testID={`services-vet-avatar-${vet.id}`}
                    className="h-12 w-12 items-center justify-center rounded-2xl bg-accent-dark"
                  >
                    <Text maxFontSizeMultiplier={1.5} className="text-base font-bold text-white font-display">
                      {vet.initial}
                    </Text>
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                      {vet.name}
                    </Text>
                    <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                      {`${vet.specialty} · ${vet.experience}`}
                    </Text>
                    <View
                      accessible
                      accessibilityLabel={strings.servicesPreview.vets.ratingA11y(vet.rating)}
                      className="flex-row items-center gap-1"
                    >
                      <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                        {`★ ${vet.rating}`}
                      </Text>
                      <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{vet.reviews}</Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row items-center justify-between border-t border-brand-100 dark:border-hairline-dark pt-3">
                  <View className="flex-row items-center gap-2">
                    <View className="rounded-full bg-brand-100 dark:bg-surface-card-dark px-3 py-1">
                      <Text
                        maxFontSizeMultiplier={1.5}
                        className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
                      >
                        {strings.servicesPreview.vets.sampleTag}
                      </Text>
                    </View>
                    <Text className="text-xs text-brand-700 dark:text-ink-muted-dark font-body">
                      {strings.servicesPreview.vets.perConsult}
                    </Text>
                  </View>
                  <PrimaryButton
                    testID={`services-vet-book-${vet.id}`}
                    label={strings.servicesPreview.vets.book}
                    onPress={() => router.push({ pathname: "/services/slots", params: { kind: "vet", id: vet.id } })}
                  />
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>
      </ScreenScaffold>
    </View>
  );
}
