import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, useColorScheme, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Card } from "../../src/components/card";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { useReducedMotion } from "../../src/hooks/use-reduced-motion";
import { PREVIEW_SALONS } from "../../src/services/preview-fixtures";
import { strings } from "../../src/strings";

/**
 * SALON LIST (PREVIEW-1 plan): sample salons only, static local fixtures.
 * Each card routes into the shared slot picker (D3) carrying the salon id.
 */
export default function ServicesSalonsScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <View testID="services-salons-screen" className="flex-1">
      <ScreenScaffold title={strings.servicesPreview.salons.title} subtitle={strings.servicesPreview.salons.subtitle}>
        <PreviewBanner />

        <View className="gap-3">
          {PREVIEW_SALONS.map((salon, i) => (
            <Animated.View key={salon.id} {...(reduced ? {} : { entering: FadeInDown.delay(i * 80).duration(320) })}>
              <Card
                testID={`services-salon-card-${salon.id}`}
                onPress={() => router.push({ pathname: "/services/slots", params: { kind: "salon", id: salon.id } })}
                accessibilityLabel={salon.name}
              >
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-100 dark:bg-surface-raised-dark">
                    <Ionicons name={salon.icon} size={20} color={iconColor} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                      {salon.name}
                    </Text>
                    <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{salon.detail}</Text>
                  </View>
                  <View className="rounded-full bg-brand-100 dark:bg-surface-card-dark px-3 py-1">
                    <Text
                      maxFontSizeMultiplier={1.5}
                      className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
                    >
                      {strings.servicesPreview.salons.sampleTag}
                    </Text>
                  </View>
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>
      </ScreenScaffold>
    </View>
  );
}
