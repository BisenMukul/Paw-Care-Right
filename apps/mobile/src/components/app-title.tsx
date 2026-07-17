import { Text } from "react-native";

import { APP_DISPLAY_NAME } from "@pawcareright/config";

export function AppTitle() {
  return (
    <Text
      testID="app-title"
      accessibilityRole="header"
      maxFontSizeMultiplier={1.5}
      className="text-2xl font-bold text-brand-700"
    >
      {APP_DISPLAY_NAME}
    </Text>
  );
}
