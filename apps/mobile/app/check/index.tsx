import { useIsOffline } from "@pawcareright/api-client";
import type { SymptomCategory } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useChecksList } from "../../src/api/checks-api";
import { CategoryGrid } from "../../src/components/category-grid";
import { CheckHistoryRow } from "../../src/components/check-history-row";
import { strings } from "../../src/strings";

/**
 * Check entry screen (T044 plan, made live by T050): the pet-home
 * "Something wrong?" CTA lands here. Renders the schema-driven category grid
 * plus a live recent-checks section (top 3 + "See all" into the T050 history
 * list), and documents the navigation contract into T045's intake screen.
 * Entry UI only — no new AI output, no diagnosis, no dosing, no §5 safety
 * surface (CLAUDE.md §7 unaffected); rows navigate into the unchanged result
 * screen.
 *
 * The category list is local schema DATA (`INTAKE_CATEGORIES`), never
 * fetched — so loading/error/empty states do not apply to it (plan R4);
 * offline is a non-blocking banner since the grid remains fully usable
 * offline. The recent-checks section, being fetched, has its own
 * loading/error/empty states.
 */
export default function CheckEntryScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const isOffline = useIsOffline();
  const { data, isLoading, isError } = useChecksList(petId ?? "");
  const recent = (data?.pages[0]?.items ?? []).slice(0, 3);

  const handleSelect = (category: SymptomCategory) => {
    router.push({ pathname: "/check/[category]", params: { category, petId } });
  };

  const handlePressRow = (id: string) => {
    router.push({ pathname: "/check/result/[checkId]", params: { checkId: id } });
  };

  const handleSeeAll = () => {
    router.push({ pathname: "/check/history/[petId]", params: { petId } });
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
            {isLoading ? (
              <ActivityIndicator testID="check-recent-loading" />
            ) : isError ? (
              <Text testID="check-recent-error" className="text-sm text-red-600">
                {strings.check.history.error}
              </Text>
            ) : recent.length === 0 ? (
              <Text testID="check-recent-empty" className="text-sm text-brand-700">
                {strings.check.recentEmpty}
              </Text>
            ) : (
              <View>
                {recent.map((item) => (
                  <CheckHistoryRow key={item.id} item={item} onPress={handlePressRow} />
                ))}
                <Pressable
                  testID="check-recent-see-all"
                  accessibilityRole="button"
                  onPress={handleSeeAll}
                  className="items-center py-2"
                >
                  <Text className="text-sm font-semibold text-brand-700">{strings.check.recentSeeAll}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
