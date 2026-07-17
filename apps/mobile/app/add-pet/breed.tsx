import { useRouter } from "expo-router";
import { Text } from "react-native";

import { BreedAutocomplete } from "../../src/components/breed-autocomplete";
import { WizardScaffold } from "../../src/components/wizard-scaffold";
import { useAddPetStore } from "../../src/pets/add-pet-store";
import { strings } from "../../src/strings";

/** Add-pet wizard step 2: breed autocomplete (skippable). */
export default function BreedScreen() {
  const router = useRouter();
  const species = useAddPetStore((state) => state.draft.species);
  const breedSlug = useAddPetStore((state) => state.draft.breedSlug);
  const setField = useAddPetStore((state) => state.setField);

  function selectBreed(breed: { slug: string; name: string }) {
    setField("breedSlug", breed.slug);
    setField("breedName", breed.name);
    router.push("/add-pet/details");
  }

  function skip() {
    setField("breedSlug", null);
    setField("breedName", null);
    router.push("/add-pet/details");
  }

  return (
    <WizardScaffold
      step={2}
      total={5}
      onBack={() => router.back()}
      onSkip={skip}
      skipLabel={strings.addPet.breed.skip}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        className="text-xl font-semibold text-brand-900"
      >
        {strings.addPet.breed.title}
      </Text>
      <BreedAutocomplete species={species} value={breedSlug} onSelect={selectBreed} />
    </WizardScaffold>
  );
}
