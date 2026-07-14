import { useRouter } from "expo-router";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "../../src/components/primary-button";
import { useActivePetStore } from "../../src/pets/active-pet-store";
import { strings } from "../../src/strings";

/**
 * Care tab (T059 plan): the second entry point into the care-plan setup
 * wizard, for the household's active pet. No pet-picker built (plan Risk
 * 6, "minimal") -- when no pet is active yet, an empty-state message is
 * shown instead of a CTA that would have nowhere to route.
 */
export default function CareScreen() {
  const router = useRouter();
  const activePetId = useActivePetStore((state) => state.activePetId);

  if (activePetId === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text testID="care-tab-no-pet" className="text-center text-base text-brand-900">
          {strings.care.noPet}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
      <Text className="text-center text-base text-brand-900">{strings.care.body}</Text>
      <PrimaryButton
        testID="care-tab-setup"
        label={strings.care.setupCta}
        onPress={() =>
          router.push({ pathname: "/care-plan/[petId]", params: { petId: activePetId } })
        }
      />
    </SafeAreaView>
  );
}
