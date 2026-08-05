import { Ionicons } from "@expo/vector-icons";
import { useColorScheme, Text, View } from "react-native";

import { Card } from "../card";
import { strings } from "../../strings";

export interface NudgeCardProps {
  testID: string;
  onPress: () => void;
}

/**
 * Tappable escalation card (T083 plan Safety statement 6): routes into the
 * EXISTING `/check/[category]` intake, which owns the deterministic
 * red-flag → emergency path. Renders NO AI content of its own and never
 * suppresses/delays anything — it appears BEFORE the assistant bubble in
 * reading order (mirroring the server, which emits `nudge` before any
 * `chunk`). A plain `Card` with `onPress` (design-system §2.2 canon).
 */
export function NudgeCard({ testID, onPress }: NudgeCardProps) {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityLabel={strings.chat.nudge.cta}
      className="min-h-[44px] flex-row items-center gap-3"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50 dark:bg-surface-raised-dark">
        <Ionicons name="medkit-outline" size={20} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.chat.nudge.title}
        </Text>
        <Text className="text-sm text-brand-700 dark:text-accent-bright font-body-semibold">{strings.chat.nudge.cta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={iconColor} />
    </Card>
  );
}
