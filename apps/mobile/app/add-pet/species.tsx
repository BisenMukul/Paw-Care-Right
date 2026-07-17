import { useRouter } from "expo-router";
import { Text } from "react-native";

import { GhostButton } from "../../src/components/ghost-button";
import { SpeciesPicker } from "../../src/components/species-picker";
import { WizardScaffold } from "../../src/components/wizard-scaffold";
import { useAddPetStore } from "../../src/pets/add-pet-store";
import { strings } from "../../src/strings";

/** Add-pet wizard step 1: species (required). */
export default function SpeciesScreen() {
  const router = useRouter();
  const species = useAddPetStore((state) => state.draft.species);
  const setField = useAddPetStore((state) => state.setField);
  const reset = useAddPetStore((state) => state.reset);

  return (
    <WizardScaffold
      step={1}
      total={5}
      onBack={() => router.back()}
      nextDisabled={species === null}
      onNext={() => router.push("/add-pet/breed")}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        className="text-xl font-semibold text-brand-900"
      >
        {strings.addPet.species.title}
      </Text>
      <SpeciesPicker value={species} onChange={(next) => setField("species", next)} />
      <GhostButton
        testID="add-pet-start-over"
        label={strings.addPet.common.startOver}
        onPress={reset}
      />
    </WizardScaffold>
  );
}
