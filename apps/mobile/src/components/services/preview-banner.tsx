import { Ionicons } from "@expo/vector-icons";
import { Text, useColorScheme, View } from "react-native";

import { strings } from "../../strings";

export interface PreviewBannerProps {
  testID?: string;
}

/**
 * The persistent, NON-dismissible PREVIEW banner (PREVIEW-1 plan HONESTY
 * ARCHITECTURE): every service-flow screen mounts this as its first scroll
 * child. There is no close/dismiss control and no `onPress` on the root --
 * a plain `View`, always visible, in both themes. Only §1.1/§1.1a-verified
 * pairs are used: `text-brand-900` on `bg-brand-100` (10.27 AAA) in light
 * mode, `text-ink-dark` on `bg-surface-raised-dark` (10.81 AAA) in dark mode
 * -- no new AA pair is introduced (plan D5).
 */
export function PreviewBanner({ testID = "services-preview-banner" }: PreviewBannerProps) {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={strings.servicesPreview.banner.a11y}
      className="flex-row items-start gap-3 rounded-lg bg-brand-100 dark:bg-surface-raised-dark px-4 py-3"
    >
      <Ionicons name="information-circle-outline" size={20} color={iconColor} />
      <View className="flex-1 gap-0.5">
        <Text
          maxFontSizeMultiplier={1.5}
          className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold"
        >
          {strings.servicesPreview.banner.label}
        </Text>
        <Text className="text-xs text-brand-900 dark:text-ink-dark font-body">
          {strings.servicesPreview.banner.text}
        </Text>
      </View>
    </View>
  );
}
