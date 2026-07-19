import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Text, useColorScheme, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Card } from "../../src/components/card";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { useReducedMotion } from "../../src/hooks/use-reduced-motion";
import { strings } from "../../src/strings";

type IconName = ComponentProps<typeof Ionicons>["name"];

interface BookMenuCard {
  key: "vet" | "salon";
  testID: string;
  title: string;
  desc: string;
  icon: IconName;
  route: "/services/vets" | "/services/salons";
}

const CARDS: BookMenuCard[] = [
  {
    key: "vet",
    testID: "services-book-vet",
    title: strings.servicesPreview.book.vetTitle,
    desc: strings.servicesPreview.book.vetDesc,
    icon: "medkit-outline",
    route: "/services/vets",
  },
  {
    key: "salon",
    testID: "services-book-salon",
    title: strings.servicesPreview.book.salonTitle,
    desc: strings.servicesPreview.book.salonDesc,
    icon: "cut-outline",
    route: "/services/salons",
  },
];

/**
 * BOOK MENU (PREVIEW-1 plan D2/D3): the mockup-faithful screen both hub
 * "Vet consultation" and "Pet salon" cards land on, branching to the vet or
 * salon list. This is the one screen that carries the §5 escalation
 * affordance out to the REAL Symptom Check flow (`/check`) -- an ADDITION,
 * never a substitute for it; this preview never renders `<VetDisclaimer/>`-
 * bearing AI content itself.
 */
export default function ServicesBookScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  return (
    <View testID="services-book-screen" className="flex-1">
      <ScreenScaffold title={strings.servicesPreview.book.title} subtitle={strings.servicesPreview.book.subtitle}>
        <PreviewBanner />

        <View className="gap-3">
          {CARDS.map((card, i) => (
            <Animated.View key={card.key} {...(reduced ? {} : { entering: FadeInDown.delay(i * 80).duration(320) })}>
              <Card testID={card.testID} onPress={() => router.push(card.route)} accessibilityLabel={card.title}>
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-100 dark:bg-surface-raised-dark">
                    <Ionicons name={card.icon} size={20} color={iconColor} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold">
                      {card.title}
                    </Text>
                    <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{card.desc}</Text>
                  </View>
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>

        <Card
          testID="services-book-emergency"
          onPress={() => router.push("/check")}
          accessibilityLabel={strings.servicesPreview.book.emergencyCta}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="alert-circle-outline" size={22} color={iconColor} />
            <Text className="flex-1 text-sm text-brand-900 dark:text-ink-dark font-body">
              {strings.servicesPreview.book.emergencyNote}
            </Text>
          </View>
          <Text
            maxFontSizeMultiplier={1.5}
            className="text-sm font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
          >
            {strings.servicesPreview.book.emergencyCta}
          </Text>
        </Card>
      </ScreenScaffold>
    </View>
  );
}
