import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Card } from "../../src/components/card";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { useReducedMotion } from "../../src/hooks/use-reduced-motion";
import { PREVIEW_STORE_PRODUCTS } from "../../src/services/preview-fixtures";
import { strings } from "../../src/strings";

/**
 * STORE (PREVIEW-1 plan D3/D4): sample products only, static local
 * fixtures, "Sample" pill in place of a numeric price. The `+` button lands
 * on the single shared honest terminal -- it never adds to a real cart.
 */
export default function ServicesStoreScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();

  return (
    <View testID="services-store-screen" className="flex-1">
      <ScreenScaffold title={strings.servicesPreview.store.title} subtitle={strings.servicesPreview.store.subtitle}>
        <PreviewBanner />

        <View className="flex-row flex-wrap gap-3">
          {PREVIEW_STORE_PRODUCTS.map((product, i) => (
            <Animated.View
              key={product.id}
              className="min-w-[47%] flex-1 basis-[47%]"
              {...(reduced ? {} : { entering: FadeInDown.delay(i * 80).duration(320) })}
            >
              <Card testID={`services-store-card-${product.id}`}>
                <View
                  testID={`services-store-tile-${product.id}`}
                  className="h-11 w-11 items-center justify-center rounded-2xl bg-category-amber"
                >
                  <Ionicons name={product.icon} size={20} color="#ffffff" />
                </View>
                <View className="self-start rounded-full bg-brand-100 dark:bg-surface-card-dark px-2 py-0.5">
                  <Text
                    maxFontSizeMultiplier={1.5}
                    className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
                  >
                    {product.tag}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
                  {product.name}
                </Text>
                <View className="flex-row items-center justify-between">
                  <View className="rounded-full bg-brand-100 dark:bg-surface-card-dark px-3 py-1">
                    <Text
                      maxFontSizeMultiplier={1.5}
                      className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
                    >
                      {strings.servicesPreview.store.sampleTag}
                    </Text>
                  </View>
                  <Pressable
                    testID={`services-store-add-${product.id}`}
                    onPress={() => router.push({ pathname: "/services/preview-end", params: { service: "store" } })}
                    accessibilityRole="button"
                    accessibilityLabel={strings.servicesPreview.store.addA11y(product.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
                    className="h-8 w-8 items-center justify-center rounded-lg bg-brand-700 dark:bg-accent-dark"
                  >
                    <Ionicons name="add-outline" size={18} color="#ffffff" />
                  </Pressable>
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>
      </ScreenScaffold>
    </View>
  );
}
