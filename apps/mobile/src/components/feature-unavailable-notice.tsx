import type { ReactElement } from "react";
import { Text, View } from "react-native";

export interface FeatureUnavailableNoticeProps {
  testID: string;
  title: string;
  body: string;
}

/**
 * T106 D8 — the §7-safe "temporarily unavailable" surface rendered in place
 * of a killed feature's primary controls (the check-entry category grid,
 * the chat composer + quick prompts). Non-dismissible chrome, not a control
 * -- no `onPress`, no close affordance (mirrors `OfflineBanner`/
 * `VetDisclaimer`): a kill switch is an operational fact, not something the
 * user can dismiss away. `title`/`body` are always caller-supplied from
 * `strings.ts` (never hardcoded prose here, per CLAUDE.md §6).
 */
export function FeatureUnavailableNotice({ testID, title, body }: FeatureUnavailableNoticeProps): ReactElement {
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      className="items-center gap-2 rounded-2xl bg-white dark:bg-surface-card-dark px-6 py-10"
    >
      <Text className="text-center text-xl font-semibold text-brand-900 dark:text-ink-dark font-display">
        {title}
      </Text>
      <Text className="text-center text-base text-brand-700 dark:text-ink-muted-dark font-body">{body}</Text>
    </View>
  );
}
