import { useRouter } from "expo-router";
import { View } from "react-native";

import { Card } from "../../src/components/card";
import { CareScoreCard } from "../../src/components/home/care-score-card";
import { EmptyHomeState } from "../../src/components/home/empty-home-state";
import { HomeHeader } from "../../src/components/home/home-header";
import { PetHeroCard } from "../../src/components/home/pet-hero-card";
import { QuickActionsGrid } from "../../src/components/home/quick-actions-grid";
import { TodayPreviewCard } from "../../src/components/home/today-preview-card";
import { PetSwitcher } from "../../src/components/pet-switcher";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { SectionHeader } from "../../src/components/section-header";
import { Skeleton } from "../../src/components/skeleton";
import { useActivePet } from "../../src/pets/use-active-pet";
import { strings } from "../../src/strings";

/**
 * Home tab (founder UI overhaul, restyled by SWEEP-1's reference adoption
 * of `ScreenScaffold`/`SectionHeader`/`Card`+`Skeleton`): animated gradient
 * background, greeting header, pet hero card (or the empty/loading hero), a
 * 2x2 quick-actions grid, and a "Today" agenda preview. No AI output, no
 * diagnosis, no dosing; this screen touches no disclaimer/emergency surface
 * (CLAUDE.md §7 unaffected).
 *
 * `HomeHeader` stays the first scroll child (rather than `ScreenScaffold`'s
 * `title` prop) so its greeting/settings-gear behavior is untouched
 * (design-system.md §2.1 risk note 1).
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
    <ScreenScaffold gradient scrollTestID="home-scroll">
      <HomeHeader />
      {hasActivePet && pet ? (
        <>
          {pets.length > 1 ? <PetSwitcher /> : null}
          <PetHeroCard
            pet={pet}
            onPress={() => router.push({ pathname: "/pets/[id]", params: { id: pet.id } })}
          />
          <CareScoreCard pet={pet} />
        </>
      ) : isLoading ? (
        <Card testID="home-hero-skeleton">
          <Skeleton lines={2} />
        </Card>
      ) : (
        <EmptyHomeState />
      )}

      <View className="gap-2">
        <SectionHeader title={strings.home.quickActionsTitle} />
        <QuickActionsGrid
          disabled={!hasActivePet}
          onCheckSymptoms={goToCheck}
          onLogWeight={goToWeight}
          onLogActivity={goToActivity}
          onVetVisit={goToVetVisit}
        />
      </View>

      <TodayPreviewCard />
    </ScreenScaffold>
  );
}
