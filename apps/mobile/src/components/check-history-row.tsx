import type { CheckResponse } from "@pawcareright/types";
import { Pressable, Text, View } from "react-native";

import { deriveCheckChip, formatCheckDate, getCategoryLabel } from "../checks/check-history";
import { URGENCY_DISPLAY } from "../checks/urgency-display";
import { strings } from "../strings";

export interface CheckHistoryRowProps {
  item: CheckResponse;
  onPress: (id: string) => void;
}

/**
 * Presentational history row (T050 plan): chip (tier or neutral "in
 * progress" status) + date + category label. Tier chips reuse the
 * §7-reviewed `strings.check.result.tierLabel` copy — no new tier wording is
 * introduced here.
 */
export function CheckHistoryRow({ item, onPress }: CheckHistoryRowProps) {
  const chip = deriveCheckChip(item);
  const date = formatCheckDate(item.createdAt);

  return (
    <Pressable
      testID={`check-history-row-${item.id}`}
      accessibilityRole="button"
      onPress={() => onPress(item.id)}
      className="min-h-[56px] flex-row items-center justify-between gap-3 border-b border-brand-100 dark:border-hairline-dark px-4 py-3"
    >
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">{getCategoryLabel(item.category)}</Text>
        {/* design-system.md §7.3 calls for `tabular-nums` here (the date is a
            short numeric/date string) -- deferred: nativewind@4.2.6/
            react-native-css-interop@0.2.6 drop `font-variant-numeric` (absent
            from `validProperties`), so the class is a silent no-op on-device
            (CRAFT-1 checker finding, mirrored in `timeline-row.tsx`). Revisit
            once css-interop maps it, or route a real `fontVariant` utility
            through `packages/config` (follow-up task, not a per-screen fix). */}
        <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body" accessibilityLabel={strings.check.history.dateA11y(date)}>
          {date}
        </Text>
      </View>
      {chip.kind === "tier" ? (
        <View
          testID={`check-history-chip-${item.id}`}
          className={`rounded-full px-3 py-1 ${URGENCY_DISPLAY[chip.urgency].chipContainerClass}`}
        >
          <Text className={`text-xs font-semibold ${URGENCY_DISPLAY[chip.urgency].chipTextClass}`}>
            {strings.check.result.tierLabel[chip.urgency]}
          </Text>
        </View>
      ) : (
        <View testID={`check-history-chip-${item.id}`} className="rounded-full bg-brand-100 dark:bg-surface-card-dark px-3 py-1">
          <Text className="text-xs font-semibold text-brand-700 dark:text-ink-muted-dark">{strings.check.history.inProgress}</Text>
        </View>
      )}
    </Pressable>
  );
}
