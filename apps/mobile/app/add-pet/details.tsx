import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { useAddPetStore } from "../../src/pets/add-pet-store";
import { WizardScaffold } from "../../src/components/wizard-scaffold";
import { strings } from "../../src/strings";

type SexOption = "MALE" | "FEMALE" | "UNKNOWN";
const SEX_OPTIONS: SexOption[] = ["MALE", "FEMALE", "UNKNOWN"];

function sexLabel(sex: SexOption): string {
  switch (sex) {
    case "MALE":
      return strings.addPet.details.male;
    case "FEMALE":
      return strings.addPet.details.female;
    case "UNKNOWN":
      return strings.addPet.details.unknown;
  }
}

function parseOptionalInt(text: string): number | null {
  if (text.trim().length === 0) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Add-pet wizard step 3: name (required) + optional details, XOR-validated. */
export default function DetailsScreen() {
  const router = useRouter();
  const draft = useAddPetStore((state) => state.draft);
  const setField = useAddPetStore((state) => state.setField);
  const [error, setError] = useState<string | null>(null);

  function handleNext() {
    if (draft.name.trim().length === 0) {
      setError(strings.addPet.details.nameRequired);
      return;
    }
    if (draft.birthDate !== null && draft.ageEstimateMonths !== null) {
      setError(strings.addPet.details.xorError);
      return;
    }
    setError(null);
    router.push("/add-pet/photo");
  }

  return (
    <WizardScaffold step={3} total={5} onBack={() => router.back()} onNext={handleNext}>
      <Text className="text-xl font-semibold text-brand-900">
        {strings.addPet.details.title}
      </Text>

      <View className="gap-2">
        <Text className="text-sm font-medium text-brand-900">
          {strings.addPet.details.nameLabel}
        </Text>
        <TextInput
          testID="details-name-input"
          value={draft.name}
          onChangeText={(text) => setField("name", text)}
          placeholder={strings.addPet.details.namePlaceholder}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-brand-900">
          {strings.addPet.details.sexLabel}
        </Text>
        <View className="flex-row gap-2">
          {SEX_OPTIONS.map((option) => (
            <Pressable
              key={option}
              testID={`details-sex-${option.toLowerCase()}`}
              onPress={() => setField("sex", option)}
              className={
                draft.sex === option
                  ? "rounded-lg border-2 border-brand-700 bg-brand-100 px-4 py-2"
                  : "rounded-lg border border-gray-300 px-4 py-2"
              }
            >
              <Text className="text-sm text-brand-900">{sexLabel(option)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-brand-900">
          {strings.addPet.details.neuteredLabel}
        </Text>
        <Switch
          testID="details-neutered-toggle"
          value={draft.neutered ?? false}
          onValueChange={(next) => setField("neutered", next)}
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-brand-900">
          {strings.addPet.details.birthDateLabel}
        </Text>
        <TextInput
          testID="details-birthdate-input"
          value={draft.birthDate ?? ""}
          onChangeText={(text) => setField("birthDate", text.trim().length === 0 ? null : text)}
          placeholder={strings.addPet.details.birthDatePlaceholder}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-brand-900">
          {strings.addPet.details.ageEstimateLabel}
        </Text>
        <TextInput
          testID="details-age-input"
          value={draft.ageEstimateMonths === null ? "" : String(draft.ageEstimateMonths)}
          onChangeText={(text) => setField("ageEstimateMonths", parseOptionalInt(text))}
          keyboardType="number-pad"
          className="rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-brand-900">
          {strings.addPet.details.weightLabel}
        </Text>
        <TextInput
          testID="details-weight-input"
          value={draft.weightGrams === null ? "" : String(draft.weightGrams)}
          onChangeText={(text) => setField("weightGrams", parseOptionalInt(text))}
          keyboardType="number-pad"
          className="rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
        />
      </View>

      {error !== null ? (
        <Text testID="details-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </WizardScaffold>
  );
}
