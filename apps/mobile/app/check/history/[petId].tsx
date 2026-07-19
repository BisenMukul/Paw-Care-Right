import { useIsOffline } from "@pawcareright/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useChecksList } from "../../../src/api/checks-api";
import { CheckHistoryRow } from "../../../src/components/check-history-row";
import { EmptyState } from "../../../src/components/empty-state";
import { PrimaryButton } from "../../../src/components/primary-button";
import { SecondaryButton } from "../../../src/components/secondary-button";
import { Skeleton } from "../../../src/components/skeleton";
import { strings } from "../../../src/strings";

/**
 * Per-pet check history (T050 plan): cursor-paginated list (chip + date +
 * category label per row), with loading/error/empty/populated/load-more
 * states and a non-blocking offline banner (persisted cache still serves
 * saved pages, mirrors `pets/[id].tsx`). Rows navigate into the unchanged,
 * already-§5-reviewed result screen — this screen introduces no new AI
 * output or safety surface.
 */
export default function CheckHistoryScreen() {
  const router = useRouter();
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useChecksList(petId ?? "");
  const isOffline = useIsOffline();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  const handlePressRow = (id: string) => {
    router.push({ pathname: "/check/result/[checkId]", params: { checkId: id } });
  };

  if (isLoading) {
    return (
      <SafeAreaView testID="check-history-loading" className="flex-1 gap-4 bg-surface-page dark:bg-surface-page-dark px-4 pt-4">
        <Skeleton lines={4} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView
        testID="check-history-error"
        className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6"
      >
        <Text className="text-center text-base text-red-700 dark:text-red-400">{strings.check.history.error}</Text>
        <PrimaryButton testID="check-history-retry" label={strings.check.history.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="check-history-screen" className="flex-1 bg-surface-page dark:bg-surface-page-dark">
      <View className="gap-3 px-4 pb-2 pt-2">
        {isOffline ? (
          <Text
            testID="check-history-offline-banner"
            accessibilityRole="alert"
            className="text-center text-sm text-brand-700 dark:text-ink-muted-dark"
          >
            {strings.check.history.offlineBanner}
          </Text>
        ) : null}
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.5} className="text-2xl font-bold text-brand-900 dark:text-ink-dark font-display">
          {strings.check.history.title}
        </Text>
      </View>
      {items.length === 0 ? (
        <View testID="check-history-empty" className="flex-1 justify-center px-4">
          <EmptyState
            icon="time-outline"
            title={strings.check.history.empty}
            body={strings.check.history.emptyBody}
          />
        </View>
      ) : (
        <ScrollView
          testID="check-history-scroll"
          className="flex-1"
          refreshControl={
            <RefreshControl tintColor="#1f6350" refreshing={isRefetching} onRefresh={() => void refetch()} />
          }
        >
          <View className="pb-8">
            {items.map((item) => (
              <CheckHistoryRow key={item.id} item={item} onPress={handlePressRow} />
            ))}
            {hasNextPage ? (
              <View className="px-4 pt-4">
                <SecondaryButton
                  testID="check-history-load-more"
                  label={isFetchingNextPage ? strings.check.history.loadingMore : strings.check.history.loadMore}
                  disabled={isFetchingNextPage}
                  onPress={() => void fetchNextPage()}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
