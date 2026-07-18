import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Text, useColorScheme, View } from "react-native";

import { Card } from "../src/components/card";
import { ScreenScaffold } from "../src/components/screen-scaffold";
import { strings } from "../src/strings";

type IconName = ComponentProps<typeof Ionicons>["name"];

const SERVICE_KEYS = ["vet", "salon", "store", "adoption", "insurance"] as const;

const SERVICE_ICONS: Record<(typeof SERVICE_KEYS)[number], IconName> = {
  vet: "medkit-outline",
  salon: "cut-outline",
  store: "bag-handle-outline",
  adoption: "heart-outline",
  insurance: "shield-checkmark-outline",
};

/**
 * Services hub (PAWSAATHI-4 plan, decisions 1-3): the single new route this
 * batch adds, reached only from Settings ("settings-services" `ListRow`).
 * Founder decision locked: a static list of five HONEST "coming soon"
 * service cards -- no booking/adopt/shop flow. There is no backend to honor
 * a signup, so there is deliberately no "Notify me at launch"/waitlist
 * capture anywhere on this screen (decision 2, HONESTY RULE): each card is a
 * plain, non-interactive `accessible` grouping (no `onPress`, not a button)
 * around a canon `Card`, carrying a visible "Coming soon" badge, plus one
 * honest footer line. Static local data -- no query, so the §6
 * four-data-states rule does not apply here (decision 3, documented not
 * skipped). Not an AI/guidance surface, so no `<VetDisclaimer/>`.
 */
export default function ServicesScreen() {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <View testID="services-screen" className="flex-1">
      <ScreenScaffold title={strings.services.title} subtitle={strings.services.subtitle}>
        <View className="gap-3">
          {SERVICE_KEYS.map((key) => {
            const item = strings.services.items[key];
            return (
              <View
                key={key}
                testID={`services-card-${key}`}
                accessible
                accessibilityLabel={strings.services.cardA11y(item.title)}
              >
                <Card>
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-surface-raised-dark">
                      <Ionicons name={SERVICE_ICONS[key]} size={20} color={iconColor} />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                        {item.title}
                      </Text>
                      <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <View
                    testID={`services-badge-${key}`}
                    className="self-start rounded-full bg-brand-100 dark:bg-surface-card-dark px-3 py-1"
                  >
                    <Text className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold">
                      {strings.services.comingSoon}
                    </Text>
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
        <Text className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.services.note}
        </Text>
      </ScreenScaffold>
    </View>
  );
}
