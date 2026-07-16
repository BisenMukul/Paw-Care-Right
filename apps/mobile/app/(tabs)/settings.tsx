import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { strings } from "../../src/strings";

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-6 bg-white px-6">
      <Text className="text-center text-base text-brand-900">
        {strings.settings.body}
      </Text>
      <Pressable
        testID="settings-family"
        onPress={() => router.push("/family")}
        accessibilityRole="button"
        className="items-center rounded-lg bg-brand-700 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">{strings.settings.family}</Text>
      </Pressable>
      <Pressable
        testID="settings-notifications"
        onPress={() => router.push("/settings/notifications")}
        accessibilityRole="button"
        className="items-center rounded-lg bg-brand-700 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">{strings.settings.notifications}</Text>
      </Pressable>
      <Pressable
        testID="settings-premium"
        onPress={() => router.push({ pathname: "/paywall", params: { source: "settings" } })}
        accessibilityRole="button"
        className="items-center rounded-lg bg-brand-700 px-6 py-3"
      >
        <Text className="text-base font-semibold text-white">{strings.settings.premium(APP_DISPLAY_NAME)}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
