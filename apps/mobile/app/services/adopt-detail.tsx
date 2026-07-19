import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, useColorScheme, View } from "react-native";

import { Card } from "../../src/components/card";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { PREVIEW_ADOPT_ABOUT_BLURB, PREVIEW_ADOPT_PETS } from "../../src/services/preview-fixtures";
import { strings } from "../../src/strings";

/**
 * ADOPT DETAIL (PREVIEW-1 plan): reads `petId`, static local fixture only.
 * The "Preview adoption for {name}" CTA lands on the shared honest terminal
 * (D3), which additionally shows the read-only "what you'll be asked" list
 * -- this screen itself collects nothing (no `TextInput`).
 */
export default function ServicesAdoptDetailScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";
  const pet = PREVIEW_ADOPT_PETS.find((p) => p.id === petId);

  if (!pet) {
    return (
      <View
        testID="services-adopt-detail-screen"
        className="flex-1 items-center justify-center gap-4 bg-brand-50 dark:bg-surface-page-dark px-6"
      >
        <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
          {strings.petHome.empty}
        </Text>
      </View>
    );
  }

  return (
    <View testID="services-adopt-detail-screen" className="flex-1">
      <ScreenScaffold
        footer={
          <PrimaryButton
            testID="services-adopt-apply"
            label={strings.servicesPreview.adopt.apply(pet.name)}
            onPress={() => router.push({ pathname: "/services/preview-end", params: { service: "adopt" } })}
          />
        }
      >
        <PreviewBanner />

        <View className="gap-3">
          <View className="relative h-56 w-full items-center justify-center rounded-2xl bg-brand-100 dark:bg-surface-raised-dark">
            <Ionicons name="image-outline" size={40} color={iconColor} />
            <Pressable
              testID="services-adopt-detail-back"
              onPress={() => router.push("/services/adopt")}
              accessibilityRole="button"
              accessibilityLabel={strings.addPet.common.back}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
              className="absolute left-3 top-3 h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-surface-card-dark"
            >
              <Ionicons name="arrow-back-outline" size={20} color={iconColor} />
            </Pressable>
          </View>

          <View className="gap-1">
            <Text className="text-2xl font-bold text-brand-900 dark:text-ink-dark font-display">{pet.name}</Text>
            <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
              {`${pet.mix} · ${pet.meta}`}
            </Text>
          </View>

          {pet.vaccinated ? (
            <View className="self-start rounded-full bg-brand-100 dark:bg-surface-card-dark px-3 py-1">
              <Text
                maxFontSizeMultiplier={1.5}
                className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
              >
                {strings.servicesPreview.adopt.vaccinated}
              </Text>
            </View>
          ) : null}

          <Card>
            <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
              {strings.servicesPreview.adopt.aboutTitle(pet.name)}
            </Text>
            <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
              {PREVIEW_ADOPT_ABOUT_BLURB}
            </Text>
          </Card>

          <View className="flex-row items-center gap-2 rounded-2xl border border-dashed border-brand-200 dark:border-hairline-dark bg-brand-50 dark:bg-surface-card-dark px-4 py-3">
            <Text className="text-xs font-semibold text-brand-700 dark:text-ink-muted-dark font-body-semibold">
              {strings.servicesPreview.adopt.listedBy}
            </Text>
            <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
              {pet.listedBy}
            </Text>
          </View>
        </View>
      </ScreenScaffold>
    </View>
  );
}
