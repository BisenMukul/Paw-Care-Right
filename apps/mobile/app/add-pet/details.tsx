import { useRouter } from "expo-router";
import { useRef, useState, type RefObject } from "react";
import { AccessibilityInfo, Pressable, Switch, Text, TextInput, View, findNodeHandle } from "react-native";

import { useAddPetStore } from "../../src/pets/add-pet-store";
import { TextField } from "../../src/components/text-field";
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
  const nameFieldRef = useRef<TextInput>(null);
  const birthDateFieldRef = useRef<TextInput>(null);

  // A single shared error region (testID `details-error`) carries both the
  // name-required and the cross-field XOR message, so at most one of these
  // two is non-null at a time -- each is rendered in the errored field's own
  // TextField error slot, keeping the testID/text a single instance in the
  // tree (no duplicate accessibility announcements).
  const nameError = error === strings.addPet.details.nameRequired ? error : null;
  const crossFieldError =
    error !== null && error !== strings.addPet.details.nameRequired ? error : null;

  function focusField(ref: RefObject<TextInput | null>) {
    const node = findNodeHandle(ref.current);
    if (node !== null) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }

  function handleNext() {
    if (draft.name.trim().length === 0) {
      setError(strings.addPet.details.nameRequired);
      focusField(nameFieldRef);
      return;
    }
    if (draft.birthDate !== null && draft.ageEstimateMonths !== null) {
      setError(strings.addPet.details.xorError);
      focusField(birthDateFieldRef);
      return;
    }
    setError(null);
    router.push("/add-pet/photo");
  }

  return (
    <WizardScaffold step={3} total={5} onBack={() => router.back()} onNext={handleNext}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        className="text-xl font-semibold text-brand-900"
      >
        {strings.addPet.details.title}
      </Text>

      <TextField
        ref={nameFieldRef}
        testID="details-name-input"
        errorTestID="details-error"
        label={strings.addPet.details.nameLabel}
        value={draft.name}
        onChangeText={(text) => setField("name", text)}
        placeholder={strings.addPet.details.namePlaceholder}
        error={nameError}
      />

      <View className="gap-2">
        <Text className="text-sm font-semibold text-brand-900">
          {strings.addPet.details.sexLabel}
        </Text>
        <View className="flex-row gap-2">
          {SEX_OPTIONS.map((option) => (
            <Pressable
              key={option}
              testID={`details-sex-${option.toLowerCase()}`}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.sex === option }}
              onPress={() => setField("sex", option)}
              className={
                draft.sex === option
                  ? "min-h-[44px] justify-center rounded-lg border-2 border-brand-700 bg-brand-100 px-4 py-2"
                  : "min-h-[44px] justify-center rounded-lg border border-brand-100 px-4 py-2"
              }
            >
              <Text className="text-sm text-brand-900">{sexLabel(option)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-brand-900">
          {strings.addPet.details.neuteredLabel}
        </Text>
        <Switch
          testID="details-neutered-toggle"
          accessibilityLabel={strings.addPet.details.neuteredA11y}
          value={draft.neutered ?? false}
          onValueChange={(next) => setField("neutered", next)}
        />
      </View>

      <TextField
        ref={birthDateFieldRef}
        testID="details-birthdate-input"
        errorTestID="details-error"
        label={strings.addPet.details.birthDateLabel}
        value={draft.birthDate ?? ""}
        onChangeText={(text) => setField("birthDate", text.trim().length === 0 ? null : text)}
        placeholder={strings.addPet.details.birthDatePlaceholder}
        error={crossFieldError}
      />

      <TextField
        testID="details-age-input"
        label={strings.addPet.details.ageEstimateLabel}
        value={draft.ageEstimateMonths === null ? "" : String(draft.ageEstimateMonths)}
        onChangeText={(text) => setField("ageEstimateMonths", parseOptionalInt(text))}
        keyboardType="number-pad"
      />

      <TextField
        testID="details-weight-input"
        label={strings.addPet.details.weightLabel}
        value={draft.weightGrams === null ? "" : String(draft.weightGrams)}
        onChangeText={(text) => setField("weightGrams", parseOptionalInt(text))}
        keyboardType="number-pad"
      />
    </WizardScaffold>
  );
}
