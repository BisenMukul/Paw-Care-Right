import { Stack } from "expo-router";

export default function AddPetLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="species" />
      <Stack.Screen name="breed" />
      <Stack.Screen name="details" />
      <Stack.Screen name="photo" />
      <Stack.Screen name="done" />
    </Stack>
  );
}
