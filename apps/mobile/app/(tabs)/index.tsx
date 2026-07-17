import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedGradientBackground } from "../../src/components/home/animated-gradient-background";
import { EmptyHomeState } from "../../src/components/home/empty-home-state";
import { HomeHeader } from "../../src/components/home/home-header";
import { PetHeroCard } from "../../src/components/home/pet-hero-card";
import { QuickActionsGrid } from "../../src/components/home/quick-actions-grid";
import { TodayPreviewCard } from "../../src/components/home/today-preview-card";
import { PetSwitcher } from "../../src/components/pet-switcher";
import { useActivePet } from "../../src/pets/use-active-pet";
import { strings } from "../../src/strings";

/**
 * Home tab (founder UI overhaul): animated gradient background, greeting
 * header, pet hero card (or the empty/no-pet hero), a 2x2 quick-actions
 * grid, and a "Today" agenda preview. No AI output, no diagnosis, no
 * dosing; this screen touches no disclaimer/emergency surface (CLAUDE.md §7
 * unaffected).
 */
export default function HomeScreen() {
  const router = useRouter();
  const { pet, pets, isLoading } = useActivePet();
  const hasActivePet = pet !== null;

  const goToCheck = () => {
    if (pet) {
      router.push({ pathname: "/check", params: { petId: pet.id } });
    }
  };
  const goToWeight = () => {
    if (pet) {
      router.push({ pathname: "/weight/[petId]", params: { petId: pet.id } });
    }
  };
  const goToActivity = () => {
    if (pet) {
      router.push({ pathname: "/activity/[petId]", params: { petId: pet.id } });
    }
  };
  const goToVetVisit = () => {
    if (pet) {
      router.push({ pathname: "/vet-visit/[petId]", params: { petId: pet.id } });
    }
  };

  return (
    <View className="flex-1">
      <AnimatedGradientBackground />
      <SafeAreaView className="flex-1">
        <View className="px-6 pb-2 pt-2">
          <HomeHeader />
        </View>
        <ScrollView testID="home-scroll" className="flex-1">
          <View className="gap-4 px-6 pb-8 pt-2">
            {hasActivePet && pet ? (
              <>
                {pets.length > 1 ? <PetSwitcher /> : null}
                <PetHeroCard
                  pet={pet}
                  onPress={() => router.push({ pathname: "/pets/[id]", params: { id: pet.id } })}
                />
              </>
            ) : (
              !isLoading && <EmptyHomeState />
            )}

            <View className="gap-2">
              <Text className="text-base font-semibold text-brand-900">
                {strings.home.quickActionsTitle}
              </Text>
              <QuickActionsGrid
                disabled={!hasActivePet}
                onCheckSymptoms={goToCheck}
                onLogWeight={goToWeight}
                onLogActivity={goToActivity}
                onVetVisit={goToVetVisit}
              />
            </View>

            <TodayPreviewCard />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
