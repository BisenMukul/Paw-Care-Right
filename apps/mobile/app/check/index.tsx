import { useIsOffline } from "@pawcareright/api-client";
import type { SymptomCategory } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryGrid } from "../../src/components/category-grid";
import { strings } from "../../src/strings";

/**
 * Check entry screen (T044 plan): the pet-home "Something wrong?" CTA lands
 * here. Renders the schema-driven category grid plus a recent-checks
 * shortcut placeholder, and documents the navigation contract into T045's
 * intake screen. Entry UI only — no AI output, no diagnosis, no dosing, no
 * §5 safety surface (CLAUDE.md §7 unaffected).
 *
 * The category list is local schema DATA (`INTAKE_CATEGORIES`), never
 * fetched — so loading/error/empty states do not apply (plan R4); offline is
 * a non-blocking banner since the grid remains fully usable offline.
 */
export default function CheckEntryScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const isOffline = useIsOffline();

  const handleSelect = (category: SymptomCategory) => {
    router.push({ pathname: "/check/[category]", params: { category, petId } });
  };

  return (
    <SafeAreaView testID="check-entry-screen" className="flex-1 bg-white">
      <View className="gap-3 px-6 pb-4 pt-2">
        {isOffline ? (
          <Text testID="check-offline-banner" className="text-center text-sm text-brand-700">
            {strings.check.offlineBanner}
          </Text>
        ) : null}
        <Text className="text-xl font-semibold text-brand-900">{strings.check.title}</Text>
        <Text className="text-base text-brand-700">{strings.check.subtitle}</Text>
      </View>
      <ScrollView testID="check-entry-scroll" className="flex-1">
        <View className="gap-6 px-6 pb-8">
          <CategoryGrid onSelect={handleSelect} />
          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">
              {strings.check.recentTitle}
            </Text>
            <Text testID="check-recent-empty" className="text-sm text-brand-700">
              {strings.check.recentEmpty}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
