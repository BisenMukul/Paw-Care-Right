import { useIsOffline } from "@pawcareright/api-client";
import { REMINDER_TYPES, type ReminderType } from "@pawcareright/types";
import { useEffect, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useNotificationPrefs, useUpdateNotificationPrefs } from "../../src/api/notification-prefs-api";
import { Card } from "../../src/components/card";
import { Chip } from "../../src/components/chip";
import { ListRow } from "../../src/components/list-row";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { strings } from "../../src/strings";

/** Fixed 30-minute option list (T058 plan decision 5) -- no new dependency. */
export const QUIET_TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Settings -> Notifications (T058 plan): per-`REMINDER_TYPES` on/off
 * switches plus an optional quiet-hours window (start/end HH:mm + device
 * timezone). No AI output, no disclaimer/emergency surface -- this screen
 * only gates/reschedules the user's own care reminder pushes (plan Safety
 * statement).
 */
export default function NotificationPrefsScreen() {
  const { data: prefs, isLoading, isError, refetch } = useNotificationPrefs();
  const isOffline = useIsOffline();
  const updatePrefs = useUpdateNotificationPrefs();

  const [disabledTypes, setDisabledTypes] = useState<Set<ReminderType>>(new Set());
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [saveError, setSaveError] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (prefs && !seeded) {
      setDisabledTypes(new Set(prefs.disabledTypes));
      setQuietEnabled(prefs.quietHours !== null);
      if (prefs.quietHours) {
        setQuietStart(prefs.quietHours.start);
        setQuietEnd(prefs.quietHours.end);
      }
      setSeeded(true);
    }
  }, [prefs, seeded]);

  function toggleType(type: ReminderType, enabled: boolean) {
    setDisabledTypes((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaveError(false);
    try {
      await updatePrefs.mutateAsync({
        disabledTypes: [...disabledTypes],
        quietHours: quietEnabled ? { start: quietStart, end: quietEnd, timezone: DEFAULT_TIMEZONE } : null,
      });
    } catch {
      setSaveError(true);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Card testID="notifications-loading">
          <Skeleton lines={4} />
        </Card>
        <Text className="text-center text-base text-brand-900 dark:text-ink-dark font-body">{strings.notifications.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !prefs) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="notifications-offline" className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
          {strings.notifications.offline}
        </Text>
        <PrimaryButton testID="notifications-retry" label={strings.notifications.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="notifications-error" className="text-center text-base text-red-700 dark:text-red-400">
          {strings.notifications.error}
        </Text>
        <PrimaryButton testID="notifications-retry" label={strings.notifications.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!prefs) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-surface-page dark:bg-surface-page-dark px-6">
        <Text testID="notifications-empty" className="text-center text-base text-brand-900 dark:text-ink-dark font-body">
          {strings.notifications.empty}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <ScreenScaffold title={strings.notifications.title} scrollTestID="notifications-scroll">
      {isOffline ? (
        <Text
          testID="notifications-offline-banner"
          accessibilityRole="alert"
          className="text-center text-sm text-brand-700 dark:text-ink-muted-dark font-body"
        >
          {strings.notifications.offlineBanner}
        </Text>
      ) : null}

      <View className="gap-2">
        <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">{strings.notifications.typesHeading}</Text>
        <Card className="gap-0 p-0">
          <View className="px-4">
            {REMINDER_TYPES.map((type) => (
              <ListRow
                key={type}
                testID={`notifications-type-row-${type}`}
                title={strings.notifications.typeLabel(type)}
                showChevron={false}
                trailing={
                  <Switch
                    testID={`notifications-type-switch-${type}`}
                    value={!disabledTypes.has(type)}
                    onValueChange={(enabled) => toggleType(type, enabled)}
                  />
                }
              />
            ))}
          </View>
        </Card>
      </View>

      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {strings.notifications.quietHours.heading}
          </Text>
          <Switch testID="notifications-quiet-enable" value={quietEnabled} onValueChange={setQuietEnabled} />
        </View>
        <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{strings.notifications.quietHours.body}</Text>

        {quietEnabled ? (
          <View testID="notifications-quiet-pickers" className="gap-4">
            <View className="gap-2">
              <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">{strings.notifications.quietHours.start}</Text>
              <ScrollView horizontal testID="notifications-quiet-start-list" contentContainerClassName="gap-2">
                {QUIET_TIME_OPTIONS.map((time) => (
                  <Chip
                    key={time}
                    testID={`notifications-quiet-start-${time}`}
                    label={time}
                    selected={time === quietStart}
                    onPress={() => setQuietStart(time)}
                  />
                ))}
              </ScrollView>
            </View>
            <View className="gap-2">
              <Text className="text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">{strings.notifications.quietHours.end}</Text>
              <ScrollView horizontal testID="notifications-quiet-end-list" contentContainerClassName="gap-2">
                {QUIET_TIME_OPTIONS.map((time) => (
                  <Chip
                    key={time}
                    testID={`notifications-quiet-end-${time}`}
                    label={time}
                    selected={time === quietEnd}
                    onPress={() => setQuietEnd(time)}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>

      <PrimaryButton
        testID="notifications-save"
        label={strings.notifications.save}
        loading={updatePrefs.isPending}
        onPress={() => void handleSave()}
      />
      {saveError ? (
        <Text testID="notifications-save-error" className="text-center text-sm text-red-700 dark:text-red-400">
          {strings.notifications.saveError}
        </Text>
      ) : null}
    </ScreenScaffold>
  );
}
