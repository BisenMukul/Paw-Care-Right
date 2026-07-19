import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Card } from "../../src/components/card";
import { Chip } from "../../src/components/chip";
import { EmptyState } from "../../src/components/empty-state";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { useReducedMotion } from "../../src/hooks/use-reduced-motion";
import { PREVIEW_ADOPT_PETS, type PreviewAdoptSpecies } from "../../src/services/preview-fixtures";
import { strings } from "../../src/strings";

type SpeciesFilter = "all" | "dog" | "cat";

const SPECIES_MAP: Record<Exclude<SpeciesFilter, "all">, PreviewAdoptSpecies> = {
  dog: "DOG",
  cat: "CAT",
};

/**
 * ADOPT BROWSE (PREVIEW-1 plan): sample rescue listings only, static local
 * fixtures, dogs+cats only (v1 species scope). Species chips filter the
 * fixture list client-side; a matching `EmptyState` covers the filtered-to-
 * zero case. Each card opens the adopt detail preview.
 */
export default function ServicesAdoptScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";
  const [species, setSpecies] = useState<SpeciesFilter>("all");

  const filtered =
    species === "all" ? PREVIEW_ADOPT_PETS : PREVIEW_ADOPT_PETS.filter((pet) => pet.species === SPECIES_MAP[species]);

  return (
    <View testID="services-adopt-screen" className="flex-1">
      <ScreenScaffold title={strings.servicesPreview.adopt.title} subtitle={strings.servicesPreview.adopt.subtitle}>
        <PreviewBanner />

        <View className="flex-row gap-2">
          <Chip
            testID="services-adopt-species-all"
            label={strings.servicesPreview.adopt.speciesAll}
            selected={species === "all"}
            onPress={() => setSpecies("all")}
          />
          <Chip
            testID="services-adopt-species-dog"
            label={strings.servicesPreview.adopt.speciesDog}
            selected={species === "dog"}
            onPress={() => setSpecies("dog")}
          />
          <Chip
            testID="services-adopt-species-cat"
            label={strings.servicesPreview.adopt.speciesCat}
            selected={species === "cat"}
            onPress={() => setSpecies("cat")}
          />
        </View>

        {filtered.length === 0 ? (
          <EmptyState testID="services-adopt-empty" icon="paw-outline" title={strings.servicesPreview.adopt.empty} />
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {filtered.map((pet, i) => (
              <Animated.View
                key={pet.id}
                className="min-w-[47%] flex-1 basis-[47%]"
                {...(reduced ? {} : { entering: FadeInDown.delay(i * 80).duration(320) })}
              >
                <Card
                  testID={`services-adopt-card-${pet.id}`}
                  onPress={() => router.push({ pathname: "/services/adopt-detail", params: { petId: pet.id } })}
                  accessibilityLabel={pet.name}
                >
                  <View className="h-24 w-full items-center justify-center rounded-xl bg-brand-100 dark:bg-surface-raised-dark">
                    <Ionicons name="image-outline" size={28} color={iconColor} />
                  </View>
                  <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                    {pet.name}
                  </Text>
                  <Text className="text-xs text-brand-700 dark:text-ink-muted-dark font-body">{pet.mix}</Text>
                  <Text className="text-xs text-brand-900 dark:text-ink-dark font-body-semibold">{pet.meta}</Text>
                  {pet.vaccinated ? (
                    <View className="self-start rounded-full bg-brand-100 dark:bg-surface-card-dark px-2 py-0.5">
                      <Text
                        maxFontSizeMultiplier={1.5}
                        className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
                      >
                        {strings.servicesPreview.adopt.vaccinated}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              </Animated.View>
            ))}
          </View>
        )}
      </ScreenScaffold>
    </View>
  );
}
