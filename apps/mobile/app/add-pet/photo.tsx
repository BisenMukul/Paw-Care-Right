import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import { WizardScaffold } from "../../src/components/wizard-scaffold";
import { compressImage } from "../../src/pets/compress-image";
import { useAddPetStore } from "../../src/pets/add-pet-store";
import { strings } from "../../src/strings";

/** Add-pet wizard step 4: photo (skippable), just-in-time permission rationale. */
export default function PhotoScreen() {
  const router = useRouter();
  const photoUri = useAddPetStore((state) => state.draft.photoUri);
  const setField = useAddPetStore((state) => state.setField);
  const [error, setError] = useState<string | null>(null);

  async function choosePhoto() {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        setError(strings.addPet.photo.permissionError);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync();
      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0]!;
      const compressed = await compressImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
      setField("photoUri", compressed.uri);
    } catch {
      setError(strings.addPet.photo.permissionError);
    }
  }

  function skip() {
    setField("photoUri", null);
    router.push("/add-pet/done");
  }

  return (
    <WizardScaffold
      step={4}
      total={5}
      onBack={() => router.back()}
      onSkip={skip}
      onNext={() => router.push("/add-pet/done")}
      nextLabel={strings.addPet.photo.finish}
    >
      <Text className="text-xl font-semibold text-brand-900">{strings.addPet.photo.title}</Text>
      <Text className="text-center text-sm text-brand-900">{strings.addPet.photo.rationale}</Text>
      <Pressable testID="add-pet-choose-photo" onPress={choosePhoto}>
        <Text className="text-center text-base font-medium text-brand-700">
          {strings.addPet.photo.choosePhoto}
        </Text>
      </Pressable>
      {photoUri !== null ? (
        <Image
          testID="add-pet-photo-preview"
          source={{ uri: photoUri }}
          className="h-32 w-32 rounded-xl"
        />
      ) : null}
      {error !== null ? (
        <Text testID="add-pet-photo-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </WizardScaffold>
  );
}
