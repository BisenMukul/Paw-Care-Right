import { useIsOffline } from "@pawcareright/api-client";
import type { ActivityType } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAddActivity, type AddActivityVars } from "../../src/api/health-logs-api";
import { usePet } from "../../src/api/pets-api";
import { ActivityChipGrid } from "../../src/components/activity-chip-grid";
import { ActivityQuantitySheet, type ActivityQuantitySheetSaveInput } from "../../src/components/activity-quantity-sheet";
import { ActivityRecentsRow, recentEntryLabel } from "../../src/components/activity-recents-row";
import { PrimaryButton } from "../../src/components/primary-button";
import { haptics } from "../../src/haptics";
import {
  useActivityRecents,
  useActivityRecentsStore,
  type ActivityRecentEntry,
} from "../../src/health-logs/activity-recents-store";
import { strings } from "../../src/strings";

/** Design-system §5.1.3's recents-row undo window; the task's explicit "6s delayed save" (no DELETE /logs endpoint exists -- see report). */
const UNDO_WINDOW_MS = 6000;

/**
 * The tap-first activity logger (design-system §5, founder-directed).
 * Gates on the pet resource exactly like `app/note/[petId].tsx` (loading/
 * error/empty/offline), then composes: a recents row (1-tap repeat, with a
 * client-side delayed-save undo -- see report for why), the 7-tile chip
 * grid (tap 1), and the pre-filled quantity sheet (tap 2 = Save). No AI
 * output, no diagnosis/dosing copy; touches no disclaimer/emergency surface
 * (CLAUDE §7 unaffected).
 */
export default function ActivityScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { data: pet, isLoading, isError, refetch } = usePet(petId);
  const addActivity = useAddActivity(petId);
  const isOffline = useIsOffline();
  const router = useRouter();

  const recents = useActivityRecents(petId);
  const addRecent = useActivityRecentsStore((state) => state.addRecent);

  const [sheetType, setSheetType] = useState<ActivityType | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{ entry: ActivityRecentEntry; label: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEntryRef = useRef<ActivityRecentEntry | null>(null);
  const flushRef = useRef<() => void>(() => undefined);

  function commitEntry(entry: ActivityRecentEntry) {
    const vars: AddActivityVars = {
      activityType: entry.activityType,
      ...(entry.quantity !== undefined ? { quantity: entry.quantity } : {}),
      ...(entry.unit !== undefined ? { unit: entry.unit } : {}),
    };
    addActivity.mutate(vars, {
      onSuccess: () => {
        haptics.success();
        addRecent(petId, entry);
      },
    });
  }

  /**
   * Commit any still-pending deferred POST NOW (checker B1): a second recent
   * tap inside the 6s window must flush the first entry's save, never drop
   * it. Also runs on unmount, so navigating away mid-window cannot lose a
   * log the user already saw confirmed. An entry only leaves
   * `pendingEntryRef` by being committed here/on timer fire, or by an
   * explicit Undo.
   */
  function flushPendingUndo() {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const pending = pendingEntryRef.current;
    pendingEntryRef.current = null;
    if (pending !== null) {
      commitEntry(pending);
    }
  }
  flushRef.current = flushPendingUndo;

  useEffect(() => {
    return () => {
      flushRef.current();
    };
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator testID="activity-screen-loading" />
        <Text className="text-center text-base text-brand-900">{strings.activity.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="activity-screen-offline" className="text-center text-base text-brand-900">
          {strings.activity.offline}
        </Text>
        <PrimaryButton testID="activity-screen-retry" label={strings.activity.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="activity-screen-error" className="text-center text-base text-red-600">
          {strings.activity.error}
        </Text>
        <PrimaryButton testID="activity-screen-retry" label={strings.activity.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="activity-screen-empty" className="text-center text-base text-brand-900">
          {strings.activity.empty}
        </Text>
      </SafeAreaView>
    );
  }

  function lastRecentForType(type: ActivityType | null): ActivityRecentEntry | undefined {
    if (type === null) {
      return undefined;
    }
    return recents.find((entry) => entry.activityType === type);
  }

  function handleChipSelect(activityType: ActivityType) {
    haptics.selection();
    setSheetType(activityType);
  }

  function handleSheetSave(input: ActivityQuantitySheetSaveInput) {
    if (sheetType === null) {
      return;
    }
    const activityType = sheetType;
    const vars: AddActivityVars = { activityType, ...input };
    addActivity.mutate(vars, {
      onSuccess: () => {
        haptics.success();
        addRecent(petId, {
          activityType,
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
        });
        setSheetType(null);
      },
    });
  }

  function handleRecentPress(entry: ActivityRecentEntry) {
    haptics.selection();
    flushPendingUndo();
    pendingEntryRef.current = entry;
    setPendingUndo({ entry, label: recentEntryLabel(entry) });

    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      const pending = pendingEntryRef.current;
      pendingEntryRef.current = null;
      if (pending !== null) {
        commitEntry(pending);
      }
      setPendingUndo(null);
    }, UNDO_WINDOW_MS);
  }

  function handleUndo() {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    pendingEntryRef.current = null;
    setPendingUndo(null);
  }

  function handleWrittenNote() {
    setSheetType(null);
    router.push({ pathname: "/note/[petId]", params: { petId } });
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {isOffline ? (
        <Text testID="activity-screen-offline-banner" className="px-6 pt-2 text-center text-sm text-brand-700">
          {strings.activity.offlineBanner}
        </Text>
      ) : null}
      <ScrollView testID="activity-screen-scroll">
        <View className="gap-6 px-6 pb-8 pt-4">
          <Text className="text-xl font-semibold text-brand-900">{strings.activity.title}</Text>

          {pendingUndo !== null ? (
            <View
              testID="activity-undo-banner"
              accessibilityRole="alert"
              className="flex-row items-center justify-between rounded-lg bg-brand-50 px-4 py-3"
            >
              <Text className="flex-1 text-sm text-brand-900">
                {strings.activity.loggedConfirmation(pendingUndo.label)}
              </Text>
              <PrimaryButton testID="activity-undo-button" label={strings.activity.undo} onPress={handleUndo} />
            </View>
          ) : null}

          <ActivityRecentsRow recents={recents} onPress={handleRecentPress} />

          <ActivityChipGrid onSelect={handleChipSelect} />
        </View>
      </ScrollView>

      <ActivityQuantitySheet
        visible={sheetType !== null}
        activityType={sheetType}
        initialQuantity={lastRecentForType(sheetType)?.quantity}
        initialUnit={lastRecentForType(sheetType)?.unit}
        submitting={addActivity.isPending}
        onSave={handleSheetSave}
        onClose={() => setSheetType(null)}
        onWrittenNote={handleWrittenNote}
      />
    </SafeAreaView>
  );
}
