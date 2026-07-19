import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Text, useColorScheme, View } from "react-native";

import { Card } from "../../src/components/card";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { strings } from "../../src/strings";

type IconName = ComponentProps<typeof Ionicons>["name"];

const SERVICE_KEYS = ["vet", "salon", "store", "adoption", "insurance"] as const;

const SERVICE_ICONS: Record<(typeof SERVICE_KEYS)[number], IconName> = {
  vet: "medkit-outline",
  salon: "cut-outline",
  store: "bag-handle-outline",
  adoption: "heart-outline",
  insurance: "shield-checkmark-outline",
};

const SERVICE_ROUTES: Record<(typeof SERVICE_KEYS)[number], string> = {
  vet: "/services/book",
  salon: "/services/book",
  store: "/services/store",
  adoption: "/services/adopt",
  insurance: "/services/insurance",
};

/**
 * Services hub (PAWSAATHI-4 plan decisions 1-3; upgraded by PREVIEW-1 plan
 * D1-D3): the gateway into the tap-through, PREVIEW-labeled service flows.
 * Every card is now pressable -- vet & salon share the mockup-faithful BOOK
 * MENU (D2, `/services/book`), store/adoption/insurance route straight into
 * their own preview screen. No card is a real booking/order/application:
 * the persistent `<PreviewBanner/>` here plus each flow's shared honest
 * terminal (D3) carry that promise end to end. Insurance stays "Coming
 * soon" -- it has no bookable flow, only its own static coming-soon screen.
 * Static local data throughout -- no query, so the §6 four-data-states rule
 * does not apply here (decision 3, documented not skipped). Not an AI/
 * guidance surface, so no `<VetDisclaimer/>`.
 */
export default function ServicesScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <View testID="services-screen" className="flex-1">
      <ScreenScaffold title={strings.services.title} subtitle={strings.services.subtitle}>
        <PreviewBanner />
        <View className="gap-3">
          {SERVICE_KEYS.map((key) => {
            const item = strings.services.items[key];
            const isInsurance = key === "insurance";
            return (
              <Card
                key={key}
                testID={`services-card-${key}`}
                onPress={() => router.push(SERVICE_ROUTES[key])}
                accessibilityLabel={
                  isInsurance ? strings.services.cardA11y(item.title) : strings.services.cardA11yPreview(item.title)
                }
              >
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
                  <Text
                    maxFontSizeMultiplier={1.5}
                    className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
                  >
                    {isInsurance ? strings.services.comingSoon : strings.services.preview}
                  </Text>
                </View>
              </Card>
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
