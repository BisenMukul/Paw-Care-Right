import { useIsOffline } from "@bombaypetcompany/api-client";
import type { AgendaEntry } from "@bombaypetcompany/types";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAgenda, useCompleteOccurrence, useSnoozeOccurrence } from "../../src/api/agenda-api";
import { AgendaItem } from "../../src/components/agenda-item";
import { Card } from "../../src/components/card";
import { EmptyState } from "../../src/components/empty-state";
import { GhostButton } from "../../src/components/ghost-button";
import { PetFilterChips } from "../../src/components/pet-filter-chips";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { useOutboxStore } from "../../src/offline/outbox-store";
import { useActivePetStore } from "../../src/pets/active-pet-store";
import { maybeRequestReview } from "../../src/review/request-review";
import { recordReminderEvent } from "../../src/review/review-state";
import { hasMissedEntry } from "../../src/review/review-trigger";
import { strings } from "../../src/strings";

/** Agenda window (T060 plan): 30 days out, well within the api's 92-day cap. */
const AGENDA_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-midnight window start (pure date math -- no `Intl`, mirrors `care-plan/[petId].tsx`'s `shiftIsoDate`). */
function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
}

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

/** Fixed "tomorrow 9:00 local" snooze default (plan "no new dep, fixed default only"). */
function tomorrowNineAmLocalIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0, 0).toISOString();
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isToday(iso: string, todayKey: string): boolean {
  return localDayKey(new Date(iso)) === todayKey;
}

/**
 * Care tab (T060 plan): the household-wide agenda -- today/upcoming
 * occurrences from `GET /agenda`, per-pet filter chips, and complete/snooze
 * actions per row (optimistic + rollback via `useCompleteOccurrence`/
 * `useSnoozeOccurrence`). Preserves the T059 care-plan wizard entry point
 * via the `agenda-care-plan` link for the active pet.
 */
export default function CareScreen() {
  const router = useRouter();
  const activePetId = useActivePetStore((state) => state.activePetId);
  const isOffline = useIsOffline();
  const pendingCount = useOutboxStore((state) => state.items.length);

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  const from = startOfTodayIso();
  const to = addDaysIso(from, AGENDA_WINDOW_DAYS);
  const agendaParams = selectedPetId !== null ? { from, to, petId: selectedPetId } : { from, to };
  const { data, isLoading, isError, isRefetching, refetch } = useAgenda(agendaParams);

  const completeMutation = useCompleteOccurrence();
  const snoozeMutation = useSnoozeOccurrence();

  // T109: resets the completion streak the moment a loaded agenda window
  // contains a MISSED occurrence -- idempotent (it just re-sets the streak
  // to 0), runs unconditionally (before any early return, rules-of-hooks),
  // and is itself a no-op read until `data` resolves.
  useEffect(() => {
    if (hasMissedEntry(data?.entries ?? [])) {
      recordReminderEvent("missed");
    }
  }, [data]);

  async function handleComplete(entry: AgendaEntry) {
    try {
      await completeMutation.mutateAsync({ reminderId: entry.reminderId, dueAt: entry.dueAt });
      // T109: a completion counts toward the streak whether it resolved as
      // a real server entry or the offline `"queued"` result (T094) -- the
      // mutation resolving at all (not throwing) is "completed" from the
      // reminder-streak gate's point of view. `decideReview` re-checks the
      // `% 5` threshold and remains the single source of truth; the `% 5`
      // here is only to avoid a pointless call on every completion.
      const streak = recordReminderEvent("completed");
      if (streak > 0 && streak % 5 === 0) {
        void maybeRequestReview("reminder-streak");
      }
    } catch {
      // The mutation's own onError already rolled the optimistic patch back
      // (plan decision 6) -- nothing further to do here.
    }
  }

  async function handleSnooze(entry: AgendaEntry) {
    try {
      await snoozeMutation.mutateAsync({
        reminderId: entry.reminderId,
        dueAt: entry.dueAt,
        snoozeUntil: tomorrowNineAmLocalIso(),
      });
      recordReminderEvent("snoozed");
    } catch {
      // Same as above.
    }
  }

  const targetPetId = selectedPetId ?? activePetId;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Card testID="agenda-loading">
          <Skeleton lines={3} />
        </Card>
        <Text className="text-center text-base text-brand-900 dark:text-ink-dark">{strings.agenda.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="agenda-offline" className="text-center text-base text-brand-900 dark:text-ink-dark">
          {strings.agenda.offline}
        </Text>
        <PrimaryButton testID="agenda-retry" label={strings.agenda.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="agenda-error" className="text-center text-base text-red-700 dark:text-red-400">
          {strings.agenda.error}
        </Text>
        <PrimaryButton testID="agenda-retry" label={strings.agenda.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  const todayKey = localDayKey(new Date());
  const entries = data?.entries ?? [];
  const todayEntries = entries.filter((entry) => isToday(entry.dueAt, todayKey));
  const upcomingEntries = entries.filter((entry) => !isToday(entry.dueAt, todayKey));

  return (
    <ScreenScaffold
      title={strings.agenda.title}
      scrollTestID="agenda-scroll"
      refreshControl={<RefreshControl tintColor="#1f6350" refreshing={isRefetching} onRefresh={() => void refetch()} />}
    >
      {isOffline ? (
        <Text
          testID="agenda-offline-banner"
          accessibilityRole="alert"
          className="text-center text-sm text-brand-700"
        >
          {strings.agenda.offlineBanner}
        </Text>
      ) : null}

      {pendingCount > 0 ? (
        <Text testID="agenda-outbox-banner" accessibilityRole="alert" className="text-center text-sm text-brand-700">
          {strings.agenda.queuedBanner(pendingCount)}
        </Text>
      ) : null}

      <PetFilterChips value={selectedPetId} onChange={setSelectedPetId} />

      {entries.length === 0 ? (
        <EmptyState
          testID="agenda-empty"
          icon="calendar-outline"
          title={strings.agenda.empty}
          body={strings.agenda.emptyBody}
        />
      ) : (
        <>
          <View testID="agenda-section-today" className="gap-3">
            <Text className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold">
              {strings.agenda.today}
            </Text>
            {todayEntries.map((entry) => (
              <AgendaItem
                key={`${entry.reminderId}:${entry.dueAt}`}
                entry={entry}
                onComplete={() => void handleComplete(entry)}
                onSnooze={() => void handleSnooze(entry)}
              />
            ))}
          </View>

          <View testID="agenda-section-upcoming" className="gap-3">
            <Text className="text-lg font-semibold text-brand-900 dark:text-ink-dark font-display-semibold">
              {strings.agenda.upcoming}
            </Text>
            {upcomingEntries.map((entry) => (
              <AgendaItem
                key={`${entry.reminderId}:${entry.dueAt}`}
                entry={entry}
                onComplete={() => void handleComplete(entry)}
                onSnooze={() => void handleSnooze(entry)}
              />
            ))}
          </View>
        </>
      )}

      {targetPetId !== null ? (
        <PrimaryButton
          testID="agenda-new"
          label={strings.agenda.newReminder}
          onPress={() => router.push({ pathname: "/reminders/edit", params: { petId: targetPetId } })}
        />
      ) : null}

      {activePetId !== null ? (
        <GhostButton
          testID="agenda-care-plan"
          label={strings.agenda.carePlanLink}
          onPress={() => router.push({ pathname: "/care-plan/[petId]", params: { petId: activePetId } })}
        />
      ) : null}
    </ScreenScaffold>
  );
}
