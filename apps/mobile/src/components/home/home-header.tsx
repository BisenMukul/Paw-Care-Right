import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, useColorScheme, View } from "react-native";

import { strings } from "../../strings";
import { AppTitle } from "../app-title";
import { type GreetingKey, greetingKeyForHour } from "./greeting";

const GREETING_TEXT: Record<GreetingKey, string> = {
  morning: strings.home.greetingMorning,
  afternoon: strings.home.greetingAfternoon,
  evening: strings.home.greetingEvening,
};

/**
 * Home tab header (founder UI overhaul): the shared brand line
 * (`APP_DISPLAY_NAME` via `AppTitle`, never hardcoded), a time-based
 * greeting, and a settings-gear button that jumps to the Settings tab.
 *
 * No household/user display name is rendered: `AuthUser`
 * (`src/auth/auth-store.ts`) only carries `id`/`email` -- there is no name
 * field anywhere in the auth store to read, so this gracefully falls back
 * to a plain greeting rather than surfacing a raw email address.
 */
export function HomeHeader() {
  const router = useRouter();
  const scheme = useColorScheme();
  const greetingKey = greetingKeyForHour(new Date().getHours());

  return (
    <View testID="home-header" className="flex-row items-center justify-between gap-3">
      <View className="gap-1">
        <AppTitle />
        <Text testID="home-greeting" className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display">
          {GREETING_TEXT[greetingKey]}
        </Text>
      </View>
      <Pressable
        testID="home-settings-button"
        onPress={() => router.push("/settings")}
        accessibilityRole="button"
        accessibilityLabel={strings.home.settingsA11y}
        className="h-10 w-10 items-center justify-center rounded-full bg-brand-50 dark:bg-surface-raised-dark"
      >
        <Ionicons name="settings-outline" size={22} color={scheme === "dark" ? "#2EA57C" : "#1f6350"} />
      </Pressable>
    </View>
  );
}
