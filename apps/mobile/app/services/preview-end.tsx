import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, useColorScheme, View } from "react-native";

import { Card } from "../../src/components/card";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { PreviewBanner } from "../../src/components/services/preview-banner";
import { SecondaryButton } from "../../src/components/secondary-button";
import { strings } from "../../src/strings";

type ServiceKey = "vet" | "salon" | "store" | "adopt";

const SERVICE_LABELS: Record<ServiceKey, string> = {
  vet: strings.servicesPreview.end.serviceVet,
  salon: strings.servicesPreview.end.serviceSalon,
  store: strings.servicesPreview.end.serviceStore,
  adopt: strings.servicesPreview.end.serviceAdopt,
};

function isServiceKey(value: string | undefined): value is ServiceKey {
  return value === "vet" || value === "salon" || value === "store" || value === "adopt";
}

/**
 * The SHARED honest terminal (PREVIEW-1 plan D3): every terminal CTA across
 * every flow (vet Book, salon pick, slot confirm, store `+`, adopt Apply)
 * lands here. Reads `service`; renders a neutral brand icon (never a
 * colored "success" circle), the one honest title/body, and -- for
 * `service==="adopt"` only -- a READ-ONLY "what you'll be asked" list
 * (collects nothing, no `TextInput`). The vocabulary boundary: this screen
 * never uses a success lexeme (confirmed/booked/purchased/approved) --
 * it always frames itself as a preview, never a real transaction.
 */
export default function ServicesPreviewEndScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";
  const { service } = useLocalSearchParams<{ service?: string }>();
  const resolvedService: ServiceKey = isServiceKey(service) ? service : "vet";
  const serviceLabel = SERVICE_LABELS[resolvedService];
  const isAdopt = resolvedService === "adopt";

  return (
    <View testID="services-preview-end-screen" className="flex-1">
      <ScreenScaffold
        footer={
          <SecondaryButton
            testID="services-preview-end-cta"
            label={isAdopt ? strings.servicesPreview.end.browseMore : strings.servicesPreview.end.done}
            onPress={() => router.push(isAdopt ? "/services/adopt" : "/services")}
          />
        }
      >
        <PreviewBanner />

        <View className="items-center gap-4 py-6">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-surface-raised-dark">
            <Ionicons name="information-circle-outline" size={32} color={iconColor} />
          </View>
          <Text
            testID="services-preview-end-title"
            className="text-center text-2xl font-bold text-brand-900 dark:text-ink-dark font-display"
          >
            {strings.servicesPreview.end.title}
          </Text>
          <Text className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body">
            {strings.servicesPreview.end.body(serviceLabel)}
          </Text>
        </View>

        {isAdopt ? (
          <Card>
            <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
              {strings.servicesPreview.end.adoptAsk}
            </Text>
            <View className="gap-1">
              {strings.servicesPreview.end.adoptFields.map((field) => (
                <Text key={field} className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">
                  {`• ${field}`}
                </Text>
              ))}
            </View>
          </Card>
        ) : null}
      </ScreenScaffold>
    </View>
  );
}
