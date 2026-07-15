import { useIsOffline } from "@pawcareright/api-client";
import type { HealthLogKind } from "@pawcareright/types";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, SectionList, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useHealthTimeline, usePrepareVetSummary, type TimelineItem } from "../../src/api/health-logs-api";
import { PrimaryButton } from "../../src/components/primary-button";
import { TimelineFilterChips } from "../../src/components/timeline-filter-chips";
import { TimelinePhotoViewer } from "../../src/components/timeline-photo-viewer";
import { TimelineRow } from "../../src/components/timeline-row";
import { groupTimelineByMonth, type TimelineSection } from "../../src/health-logs/timeline-sections";
import { useActivePetStore } from "../../src/pets/active-pet-store";
import { strings } from "../../src/strings";

interface PhotoViewerState {
  petId: string;
  photoKeys: string[];
  index: number;
}

/**
 * Timeline tab (T067 plan): an infinite, virtualized `SectionList` of the
 * active pet's health-log entries, grouped into device-local month
 * sections, filterable by kind. CHECK_REF rows deep-link to the already-§5-
 * reviewed `/check/result/[checkId]` screen; every other row is a plain
 * record (CLAUDE §7 rule 2 -- no interpretive copy anywhere here). The
 * source pet is the active-pet store (no in-tab pet switcher, decision 4):
 * the timeline endpoint is strictly pet-scoped.
 */
export default function TimelineScreen() {
  const router = useRouter();
  const activePetId = useActivePetStore((state) => state.activePetId);
  const [kind, setKind] = useState<HealthLogKind | null>(null);
  const [vetSummaryError, setVetSummaryError] = useState(false);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState | null>(null);
  const isOffline = useIsOffline();

  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useHealthTimeline(
    activePetId ?? "",
    kind,
  );
  const prepareVetSummary = usePrepareVetSummary(activePetId ?? "");

  // T068: on-demand fetch-then-share -- no throw surfaces to the user, a
  // neutral inline error string is shown instead (CLAUDE §7 -- record
  // digest only, no interpretive copy).
  const handlePrepareVetSummary = async () => {
    setVetSummaryError(false);
    try {
      const { summary } = await prepareVetSummary.mutateAsync();
      await Share.share({ message: summary });
    } catch {
      setVetSummaryError(true);
    }
  };

  // Stable across re-renders (required for `TimelineRow`'s `React.memo` to
  // bail out on unchanged rows when a page is appended -- plan decision 2).
  const handlePressCheck = useCallback(
    (checkId: string) => {
      router.push({ pathname: "/check/result/[checkId]", params: { checkId } });
    },
    [router],
  );

  // Stable across re-renders (required for `TimelineRow`'s `React.memo` to
  // bail out on unchanged rows -- T069 plan decision 4, same discipline as
  // `handlePressCheck` above).
  const handleOpenPhoto = useCallback((args: PhotoViewerState) => {
    setPhotoViewer(args);
  }, []);

  if (activePetId === null) {
    return (
      <SafeAreaView testID="timeline-no-pet" className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text className="text-center text-base text-brand-900">{strings.timeline.noPet}</Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView testID="timeline-loading" className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator />
        <Text className="text-center text-base text-brand-900">{strings.timeline.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !data) {
    return (
      <SafeAreaView testID="timeline-offline" className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text className="text-center text-base text-brand-900">{strings.timeline.offline}</Text>
        <PrimaryButton testID="timeline-retry" label={strings.timeline.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError && !data) {
    return (
      <SafeAreaView testID="timeline-error" className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text className="text-center text-base text-red-600">{strings.timeline.error}</Text>
        <PrimaryButton testID="timeline-retry" label={strings.timeline.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  const items: TimelineItem[] = data?.pages.flatMap((page) => page.items) ?? [];
  const sections: TimelineSection[] = groupTimelineByMonth(items);

  return (
    <SafeAreaView testID="timeline-screen" className="flex-1 bg-white">
      <SectionList
        testID="timeline-list"
        sections={sections}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        renderItem={({ item }) => (
          <TimelineRow item={item} petId={activePetId} onPressCheck={handlePressCheck} onOpenPhoto={handleOpenPhoto} />
        )}
        renderSectionHeader={({ section }) => (
          <Text
            testID={`timeline-section-${section.title}`}
            className="bg-white px-4 py-2 text-sm font-semibold text-brand-700"
          >
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View className="gap-3 px-4 pt-4">
            {isOffline ? (
              <Text testID="timeline-offline-banner" className="text-center text-sm text-brand-700">
                {strings.timeline.offlineBanner}
              </Text>
            ) : null}
            <Text className="text-xl font-semibold text-brand-900">{strings.timeline.title}</Text>
            <PrimaryButton
              testID="timeline-vet-summary"
              label={strings.timeline.vetSummary}
              onPress={() => void handlePrepareVetSummary()}
              disabled={prepareVetSummary.isPending}
            />
            {vetSummaryError ? (
              <Text testID="timeline-vet-summary-error" className="text-center text-sm text-red-600">
                {strings.timeline.vetSummaryError}
              </Text>
            ) : null}
            <TimelineFilterChips value={kind} onChange={setKind} />
          </View>
        }
        ListEmptyComponent={
          <View testID="timeline-empty" className="items-center px-6 py-8">
            <Text className="text-center text-base text-brand-900">{strings.timeline.empty}</Text>
          </View>
        }
        ListFooterComponent={<View className="h-8" />}
      />
      {photoViewer !== null ? (
        <TimelinePhotoViewer
          visible
          petId={photoViewer.petId}
          photoKeys={photoViewer.photoKeys}
          initialIndex={photoViewer.index}
          onClose={() => setPhotoViewer(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
