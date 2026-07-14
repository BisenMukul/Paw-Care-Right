import { useIsOffline } from "@pawcareright/api-client";
import { REMINDER_TYPES, type ReminderType } from "@pawcareright/types";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useNotificationPrefs, useUpdateNotificationPrefs } from "../../src/api/notification-prefs-api";
import { PrimaryButton } from "../../src/components/primary-button";
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
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator testID="notifications-loading" />
        <Text className="text-center text-base text-brand-900">{strings.notifications.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isOffline && !prefs) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="notifications-offline" className="text-center text-base text-brand-900">
          {strings.notifications.offline}
        </Text>
        <PrimaryButton testID="notifications-retry" label={strings.notifications.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="notifications-error" className="text-center text-base text-red-600">
          {strings.notifications.error}
        </Text>
        <PrimaryButton testID="notifications-retry" label={strings.notifications.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (!prefs) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="notifications-empty" className="text-center text-base text-brand-900">
          {strings.notifications.empty}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView testID="notifications-scroll" className="flex-1">
        <View className="gap-6 px-6 pb-8 pt-4">
          {isOffline ? (
            <Text testID="notifications-offline-banner" className="text-center text-sm text-brand-700">
              {strings.notifications.offlineBanner}
            </Text>
          ) : null}
          <Text className="text-xl font-semibold text-brand-900">{strings.notifications.title}</Text>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.notifications.typesHeading}</Text>
            {REMINDER_TYPES.map((type) => (
              <View
                key={type}
                testID={`notifications-type-row-${type}`}
                className="flex-row items-center justify-between rounded-lg border border-brand-100 px-4 py-3"
              >
                <Text className="text-base text-brand-900">{strings.notifications.typeLabel(type)}</Text>
                <Switch
                  testID={`notifications-type-switch-${type}`}
                  value={!disabledTypes.has(type)}
                  onValueChange={(enabled) => toggleType(type, enabled)}
                />
              </View>
            ))}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-brand-900">
                {strings.notifications.quietHours.heading}
              </Text>
              <Switch
                testID="notifications-quiet-enable"
                value={quietEnabled}
                onValueChange={setQuietEnabled}
              />
            </View>
            <Text className="text-sm text-brand-700">{strings.notifications.quietHours.body}</Text>

            {quietEnabled ? (
              <View testID="notifications-quiet-pickers" className="gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-semibold text-brand-900">{strings.notifications.quietHours.start}</Text>
                  <ScrollView horizontal testID="notifications-quiet-start-list">
                    {QUIET_TIME_OPTIONS.map((time) => (
                      <Text
                        key={time}
                        testID={`notifications-quiet-start-${time}`}
                        onPress={() => setQuietStart(time)}
                        className={
                          time === quietStart
                            ? "mr-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
                            : "mr-2 rounded-lg border border-brand-100 px-3 py-2 text-sm text-brand-900"
                        }
                      >
                        {time}
                      </Text>
                    ))}
                  </ScrollView>
                </View>
                <View className="gap-2">
                  <Text className="text-sm font-semibold text-brand-900">{strings.notifications.quietHours.end}</Text>
                  <ScrollView horizontal testID="notifications-quiet-end-list">
                    {QUIET_TIME_OPTIONS.map((time) => (
                      <Text
                        key={time}
                        testID={`notifications-quiet-end-${time}`}
                        onPress={() => setQuietEnd(time)}
                        className={
                          time === quietEnd
                            ? "mr-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
                            : "mr-2 rounded-lg border border-brand-100 px-3 py-2 text-sm text-brand-900"
                        }
                      >
                        {time}
                      </Text>
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
            <Text testID="notifications-save-error" className="text-center text-sm text-red-600">
              {strings.notifications.saveError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
