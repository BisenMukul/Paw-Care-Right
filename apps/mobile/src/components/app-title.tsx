import { Text } from "react-native";

import { APP_DISPLAY_NAME } from "@pawcareright/config";

export interface AppTitleProps {
  /** `"default"` (unchanged) keeps every existing call site's exact look; `"hero"` is the pre-auth welcome-screen treatment (design-system.md §1.4 display role). */
  variant?: "default" | "hero";
}

export function AppTitle({ variant = "default" }: AppTitleProps) {
  return (
    <Text
      testID="app-title"
      accessibilityRole="header"
      maxFontSizeMultiplier={1.5}
      className={variant === "hero" ? "text-3xl font-bold text-brand-700" : "text-2xl font-bold text-brand-700"}
    >
      {APP_DISPLAY_NAME}
    </Text>
  );
}
