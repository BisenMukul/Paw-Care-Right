import type { ReactElement, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, type RefreshControlProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLayoutBucket } from "../hooks/use-layout-bucket";
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
  /**
   * Design-system §7.4 thumb-zone: a bottom-pinned region below the
   * ScrollView (safe-area padded, above the keyboard), for single-action
   * screens' primary CTA. Additive/optional — omitting it renders exactly
   * as before (no `KeyboardAvoidingView`, no footer `View`), so every
   * existing caller is byte-identical.
   */
  footer?: ReactNode;
}

const DEFAULT_CONTENT_CLASS = "gap-6 px-4 pb-8";
// RESPONSIVE-1 plan D6: on `wide` (>=768dp), center a Tailwind-scale reading
// column instead of stretching content edge-to-edge on tablets. Additive
// only -- the `regular`/`compact` string stays exactly `DEFAULT_CONTENT_CLASS`
// (or the caller's `contentClassName`), byte-identical to before this task.
const WIDE_SCAFFOLD_EXTRA = "w-full max-w-3xl self-center";

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
  footer,
}: ScreenScaffoldProps) {
  const bucket = useLayoutBucket();
  const isWide = bucket === "wide";
  const baseContentClass = contentClassName ?? DEFAULT_CONTENT_CLASS;
  const resolvedContentClass = isWide ? `${baseContentClass} ${WIDE_SCAFFOLD_EXTRA}` : baseContentClass;

  const scroll = (
    <ScrollView
      testID={scrollTestID}
      {...(footer !== undefined ? { className: "flex-1" } : {})}
      contentContainerClassName={resolvedContentClass}
      {...(refreshControl ? { refreshControl } : {})}
    >
      {title ? (
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.5}
            className="text-2xl font-bold text-brand-900 dark:text-ink-dark font-display"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );

  if (footer === undefined) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-brand-50 dark:bg-surface-page-dark">
        {gradient ? <AnimatedGradientBackground /> : null}
        {scroll}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-brand-50 dark:bg-surface-page-dark">
      {gradient ? <AnimatedGradientBackground /> : null}
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll}
        <View
          testID="screen-scaffold-footer"
          className={
            isWide
              ? `border-t border-brand-100 dark:border-hairline-dark bg-brand-50 dark:bg-surface-page-dark px-4 pb-6 pt-3 ${WIDE_SCAFFOLD_EXTRA}`
              : "border-t border-brand-100 dark:border-hairline-dark bg-brand-50 dark:bg-surface-page-dark px-4 pb-6 pt-3"
          }
        >
          {footer}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
