import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { strings } from "../../src/strings";

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-center text-base text-brand-900">
        {strings.settings.body}
      </Text>
    </SafeAreaView>
  );
}
