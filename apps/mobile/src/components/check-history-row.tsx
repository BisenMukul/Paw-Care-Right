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
      className="flex-row items-center justify-between gap-3 border-b border-brand-100 px-4 py-3"
    >
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold text-brand-900">{getCategoryLabel(item.category)}</Text>
        <Text className="text-sm text-brand-700" accessibilityLabel={strings.check.history.dateA11y(date)}>
          {date}
        </Text>
      </View>
      {chip.kind === "tier" ? (
        <View
          testID={`check-history-chip-${item.id}`}
          className={`rounded-full px-3 py-1 ${URGENCY_DISPLAY[chip.urgency].containerClass}`}
        >
          <Text className={`text-xs font-semibold ${URGENCY_DISPLAY[chip.urgency].textClass}`}>
            {strings.check.result.tierLabel[chip.urgency]}
          </Text>
        </View>
      ) : (
        <View testID={`check-history-chip-${item.id}`} className="rounded-full bg-brand-100 px-3 py-1">
          <Text className="text-xs font-semibold text-brand-700">{strings.check.history.inProgress}</Text>
        </View>
      )}
    </Pressable>
  );
}
