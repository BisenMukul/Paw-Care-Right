import { useIsOffline } from "@pawcareright/api-client";
import { Ionicons } from "@expo/vector-icons";
import type { AgendaEntry } from "@pawcareright/types";
import { useRouter } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from "react-native";

import { useAgenda } from "../../api/agenda-api";
import { strings } from "../../strings";

type IconName = ComponentProps<typeof Ionicons>["name"];

const KIND_ICON: Record<string, IconName> = {
  VACCINE: "medkit-outline",
  PARASITE: "bug-outline",
  MEDICATION: "medical-outline",
  GROOMING: "cut-outline",
  DENTAL: "happy-outline",
  VET_VISIT: "business-outline",
  CUSTOM: "calendar-outline",
};

/** `AgendaEntry.type` is an open string vocabulary (mirrors `strings.ts`'s `agendaTypeLabel`) -- an unrecognized value falls back to a generic calendar icon. */
function iconForKind(type: string): IconName {
  return KIND_ICON[type] ?? "calendar-outline";
}

/** Deterministic UTC-slice HH:mm (mirrors `AgendaItem`'s `formatDueTime`). */
function formatDueTime(iso: string): string {
  return iso.slice(11, 16);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PREVIEW_WINDOW_DAYS = 30;
const PREVIEW_LIMIT = 3;

function startOfTodayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
}

function addDaysIso(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

function AgendaRow({ entry, iconColor }: { entry: AgendaEntry; iconColor: string }) {
  const dueAtMs = new Date(entry.dueAt).getTime();
  return (
    <View
      testID={`home-today-entry-${entry.reminderId}-${dueAtMs}`}
      className="flex-row items-center gap-3 py-1"
    >
      <Ionicons name={iconForKind(entry.type)} size={18} color={iconColor} />
      <Text className="flex-1 text-sm text-brand-900 dark:text-ink-dark font-body">{entry.title}</Text>
      <Text className="text-xs text-brand-700 dark:text-ink-muted-dark font-body">{formatDueTime(entry.dueAt)}</Text>
    </View>
  );
}

/**
 * Home tab "Today" preview (founder UI overhaul): up to 3 upcoming agenda
 * entries, household-wide (no `petId` filter -- the SAME `useAgenda` hook
 * the Care tab uses, no new fetching logic). Entries arrive dueAt-ascending
 * from the api (`RemindersService`), so no client re-sort is needed before
 * the slice.
 */
export function TodayPreviewCard() {
  const router = useRouter();
  const isOffline = useIsOffline();
  const scheme = useColorScheme();
  const iconColor = scheme === "dark" ? "#2EA57C" : "#1f6350";
  const from = startOfTodayIso();
  const to = addDaysIso(from, PREVIEW_WINDOW_DAYS);
  const { data, isLoading, isError, refetch } = useAgenda({ from, to });

  let body: ReactNode;
  if (isLoading) {
    body = <ActivityIndicator testID="home-today-loading" />;
  } else if (isOffline && !data) {
    body = (
      <View className="items-center gap-2">
        <Text testID="home-today-offline" className="text-center text-sm text-brand-900 dark:text-ink-dark font-body">
          {strings.home.todayOffline}
        </Text>
        <Pressable testID="home-today-retry" onPress={() => refetch()} accessibilityRole="button">
          <Text className="text-sm font-semibold text-brand-700 dark:text-accent-bright font-body-semibold">
            {strings.home.todayRetry}
          </Text>
        </Pressable>
      </View>
    );
  } else if (isError) {
    body = (
      <View className="items-center gap-2">
        <Text testID="home-today-error" className="text-center text-sm text-red-600">
          {strings.home.todayError}
        </Text>
        <Pressable testID="home-today-retry" onPress={() => refetch()} accessibilityRole="button">
          <Text className="text-sm font-semibold text-brand-700 dark:text-accent-bright font-body-semibold">
            {strings.home.todayRetry}
          </Text>
        </Pressable>
      </View>
    );
  } else {
    const entries = (data?.entries ?? []).slice(0, PREVIEW_LIMIT);
    body = (
      <>
        {isOffline ? (
          <Text
            testID="home-today-offline-banner"
            className="pb-1 text-center text-xs text-brand-700 dark:text-ink-muted-dark font-body"
          >
            {strings.home.todayOfflineBanner}
          </Text>
        ) : null}
        {entries.length === 0 ? (
          <Text testID="home-today-empty" className="text-center text-sm text-brand-900 dark:text-ink-dark font-body">
            {strings.home.todayEmpty}
          </Text>
        ) : (
          <View className="gap-2">
            {entries.map((entry) => (
              <AgendaRow key={`${entry.reminderId}:${entry.dueAt}`} entry={entry} iconColor={iconColor} />
            ))}
          </View>
        )}
      </>
    );
  }

  return (
    <View testID="home-today-card" className="gap-3 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-4 shadow-md">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
          {strings.home.todayTitle}
        </Text>
        <Pressable
          testID="home-today-see-all"
          onPress={() => router.push("/care")}
          accessibilityRole="button"
          accessibilityLabel={strings.home.seeAll}
        >
          <Text className="text-sm font-semibold text-brand-700 dark:text-accent-bright font-body-semibold">
            {strings.home.seeAll}
          </Text>
        </Pressable>
      </View>
      {body}
    </View>
  );
}
