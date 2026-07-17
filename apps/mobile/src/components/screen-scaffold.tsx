import type { ReactElement, ReactNode } from "react";
import { ScrollView, Text, View, type RefreshControlProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedGradientBackground } from "./home/animated-gradient-background";

export interface ScreenScaffoldProps {
  title?: string;
  subtitle?: string;
  /** The home-tab-only animated gradient signature (design-system.md §2.1) — every other screen stays the calm solid `bg-brand-50`. */
  gradient?: boolean;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollTestID?: string;
  /** Default `"gap-6 px-4 pb-8"` (design-system.md §1.2 spacing scale). */
  contentClassName?: string;
}

const DEFAULT_CONTENT_CLASS = "gap-6 px-4 pb-8";

/**
 * The one wrapper every tab/stack screen composes (design-system.md §2.1):
 * safe-area top, `bg-brand-50` page tint, a scrollable content region on
 * the shared spacing scale, and an optional screen title/subtitle. `title`
 * stays optional so screens that render their own bespoke header (e.g. the
 * home tab's `HomeHeader`) can render it as the first scroll child
 * instead.
 */
export function ScreenScaffold({
  title,
  subtitle,
  gradient = false,
  children,
  refreshControl,
  scrollTestID,
  contentClassName,
}: ScreenScaffoldProps) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-brand-50">
      {gradient ? <AnimatedGradientBackground /> : null}
      <ScrollView
        testID={scrollTestID}
        contentContainerClassName={contentClassName ?? DEFAULT_CONTENT_CLASS}
        {...(refreshControl ? { refreshControl } : {})}
      >
        {title ? (
          <View className="gap-1">
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.5}
              className="text-2xl font-bold text-brand-900"
            >
              {title}
            </Text>
            {subtitle ? <Text className="text-sm text-brand-700">{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
