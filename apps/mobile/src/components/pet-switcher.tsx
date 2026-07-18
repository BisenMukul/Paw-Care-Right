import type { Pet } from "@pawcareright/types";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useActivePet } from "../pets/use-active-pet";
import { strings } from "../strings";
import { PrimaryButton } from "./primary-button";

/** Placeholder circle with the pet's first initial (plan D4 — no photoKey→URL resolver yet). */
function PetAvatar({ pet, testID }: { pet: Pet; testID: string }) {
  return (
    <View
      testID={testID}
      className="h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-surface-raised-dark"
    >
      <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
        {pet.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Header pet switcher (T027): static header for a single pet, avatar row +
 * dropdown for multiple pets, add-pet CTA when there are none. Self-
 * contained — composes `useActivePet` (the one hook every pet-scoped screen
 * reads) internally rather than taking props.
 */
export function PetSwitcher() {
  const router = useRouter();
  const { pet, pets, isLoading, isError, setActivePet } = useActivePet();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (isLoading) {
    return (
      <View testID="pet-switcher" className="items-center py-2">
        <ActivityIndicator testID="pet-switcher-loading" />
      </View>
    );
  }

  if (isError) {
    return null;
  }

  if (pets.length === 0) {
    return (
      <View testID="pet-switcher" className="items-center py-2">
        <PrimaryButton
          testID="pet-switcher-empty-cta"
          label={strings.addPet.homeCta}
          onPress={() => router.push("/add-pet/species")}
        />
      </View>
    );
  }

  if (pets.length === 1) {
    const onlyPet = pets[0] as Pet;
    return (
      <View testID="pet-switcher" className="flex-row items-center gap-3 py-2">
        <PetAvatar pet={onlyPet} testID={`pet-switcher-avatar-${onlyPet.id}`} />
        <Text testID="pet-switcher-active-name" className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold">
          {onlyPet.name}
        </Text>
      </View>
    );
  }

  return (
    <View testID="pet-switcher" className="gap-3 py-2">
      <Pressable
        testID="pet-switcher-dropdown-button"
        onPress={() => setDropdownOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={strings.switcher.switchA11y}
        className="flex-row items-center gap-2"
      >
        <Text testID="pet-switcher-active-name" className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold">
          {pet?.name ?? ""}
        </Text>
        <Text className="text-base text-brand-900 dark:text-ink-dark font-body">{"▾"}</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {pets.map((p) => (
            <Pressable key={p.id} onPress={() => setActivePet(p.id)}>
              <PetAvatar pet={p} testID={`pet-switcher-avatar-${p.id}`} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <Pressable
          className="flex-1 justify-center bg-black/40 px-6"
          onPress={() => setDropdownOpen(false)}
        >
          <View className="gap-2 rounded-lg bg-white dark:bg-surface-card-dark p-4">
            <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
              {strings.switcher.heading}
            </Text>
            {pets.map((p) => (
              <Pressable
                key={p.id}
                testID={`pet-switcher-dropdown-item-${p.id}`}
                onPress={() => {
                  setActivePet(p.id);
                  setDropdownOpen(false);
                }}
                className="flex-row items-center gap-3 py-2"
              >
                <PetAvatar pet={p} testID={`pet-switcher-dropdown-avatar-${p.id}`} />
                <Text className="text-base text-brand-900 dark:text-ink-dark font-body">{p.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
