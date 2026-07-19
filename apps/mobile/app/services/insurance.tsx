import { Ionicons } from "@expo/vector-icons";
import { Text, useColorScheme, View } from "react-native";

import { Card } from "../../src/components/card";
import { ListRow } from "../../src/components/list-row";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { strings } from "../../src/strings";

/**
 * INSURANCE COMING SOON (PREVIEW-1 plan): a static hero + 3 benefit rows,
 * still an honest "coming soon" state -- NO waitlist/"Notify me" button, NO
 * "you're on the list", NO price, NO launch date (HONESTY + CLAUDE §7).
 */
export default function ServicesInsuranceScreen() {
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";

  const benefits = [
    strings.servicesPreview.insurance.benefit1,
    strings.servicesPreview.insurance.benefit2,
    strings.servicesPreview.insurance.benefit3,
  ];

  return (
    <View testID="services-insurance-screen" className="flex-1">
      <ScreenScaffold title={strings.servicesPreview.insurance.title}>
        <PreviewBanner />

        <Card className="items-center gap-2 bg-brand-100 dark:bg-surface-raised-dark">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-surface-card-dark">
            <Ionicons name="shield-checkmark-outline" size={28} color={iconColor} />
          </View>
          <View className="self-center rounded-full bg-white dark:bg-surface-card-dark px-3 py-1">
            <Text
              maxFontSizeMultiplier={1.5}
              className="text-xs font-semibold text-brand-700 dark:text-accent-bright font-body-semibold"
            >
              {strings.servicesPreview.insurance.comingSoon}
            </Text>
          </View>
          <Text className="text-center text-xl font-bold text-brand-900 dark:text-ink-dark font-display">
            {strings.servicesPreview.insurance.heroTitle}
          </Text>
          <Text className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
            {strings.servicesPreview.insurance.heroBody}
          </Text>
        </Card>

        <Card className="gap-0 p-0">
          <View className="px-4">
            {benefits.map((benefit) => (
              <ListRow key={benefit} title={benefit} leadingIcon="checkmark-circle-outline" showChevron={false} />
            ))}
          </View>
        </Card>

        <Text className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
          {strings.servicesPreview.insurance.note}
        </Text>
      </ScreenScaffold>
    </View>
  );
}
