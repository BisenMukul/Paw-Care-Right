import { useIsOffline } from "@pawcareright/api-client";
import { REMINDER_TYPES } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCreateReminder, useReminder, useUpdateReminder } from "../../src/api/reminders-api";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScheduleBuilder } from "../../src/components/schedule-builder";
import { buildRRule, parseRRuleToScheduleConfig, type ScheduleConfig } from "../../src/reminders/schedule-builder";
import { strings } from "../../src/strings";

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Same 30-minute option-list pattern as `settings/notifications.tsx`'s `QUIET_TIME_OPTIONS` (T060 plan) -- no new dependency. */
const TIME_OF_DAY_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function dateStringFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function timeStringFromDate(date: Date): string {
  const minute = date.getMinutes() < 30 ? "00" : "30";
  return `${pad2(date.getHours())}:${minute}`;
}

/** `noUncheckedIndexedAccess`-safe `YYYY-MM-DD` parse (each component defaults to a sane fallback, never `undefined`). */
function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

/** `noUncheckedIndexedAccess`-safe `HH:mm` parse. */
function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

/** Pure calendar-day shift on a `YYYY-MM-DD` string (mirrors `care-plan/[petId].tsx`'s `shiftIsoDate` -- no new date-picker dependency). */
function shiftDateString(dateStr: string, days: number): string {
  const { year, month, day } = parseDateString(dateStr);
  const shifted = new Date(year, month - 1, day);
  shifted.setDate(shifted.getDate() + days);
  return dateStringFromDate(shifted);
}

/** Combines a `YYYY-MM-DD` date and an `HH:mm` time as LOCAL wall-clock, then converts to UTC ISO (T060 plan "startAt = local date+time -> toISOString()"). */
function combineLocalDateTime(dateStr: string, timeStr: string): string {
  const { year, month, day } = parseDateString(dateStr);
  const { hour, minute } = parseTimeString(timeStr);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

/**
 * Create/edit custom reminder screen (T060 plan). No `medNameAsEntered`
 * field, no dose/drug-name copy anywhere on this form (plan Safety
 * statement) -- selecting `type: MEDICATION` only records the user's own
 * title, exactly like every other type.
 */
export default function ReminderEditScreen() {
  const router = useRouter();
  const { reminderId, petId } = useLocalSearchParams<{ reminderId?: string; petId?: string }>();
  const reminderIdParam = reminderId ?? "";
  const isEdit = reminderIdParam.length > 0;
  const isOffline = useIsOffline();

  const { data: existing, isLoading, isError, refetch } = useReminder(reminderIdParam);
  const createMutation = useCreateReminder(petId ?? "");
  const updateMutation = useUpdateReminder(reminderIdParam);

  const [type, setType] = useState<string>("CUSTOM");
  const [title, setTitle] = useState("");
  const [schedule, setSchedule] = useState<ScheduleConfig>({ freq: "DAILY", interval: 1 });
  const [startDate, setStartDate] = useState(todayDateString());
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [seeded, setSeeded] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (isEdit && existing && !seeded) {
      setType(existing.type);
      setTitle(existing.title);
      setSchedule(parseRRuleToScheduleConfig(existing.rrule));
      const startAtDate = new Date(existing.startAt);
      setStartDate(dateStringFromDate(startAtDate));
      setTimeOfDay(timeStringFromDate(startAtDate));
      setSeeded(true);
    }
  }, [isEdit, existing, seeded]);

  async function handleSave() {
    setSaveError(false);
    const rrule = buildRRule(schedule);
    const startAt = combineLocalDateTime(startDate, timeOfDay);

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ type, title, rrule, timezone: DEFAULT_TIMEZONE, startAt });
      } else {
        await createMutation.mutateAsync({ type, title, rrule, timezone: DEFAULT_TIMEZONE, startAt });
      }
      router.back();
    } catch {
      setSaveError(true);
    }
  }

  if (isEdit && isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <ActivityIndicator testID="reminder-form-loading" />
        <Text className="text-center text-base text-brand-900">{strings.reminderForm.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isEdit && isOffline && !existing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="reminder-form-offline" className="text-center text-base text-brand-900">
          {strings.reminderForm.error}
        </Text>
        <PrimaryButton testID="reminder-form-retry" label={strings.reminderForm.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isEdit && isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-white px-6">
        <Text testID="reminder-form-error" className="text-center text-base text-red-600">
          {strings.reminderForm.error}
        </Text>
        <PrimaryButton testID="reminder-form-retry" label={strings.reminderForm.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView testID="reminder-form-scroll" className="flex-1">
        <View className="gap-6 px-6 pb-8 pt-4">
          <Text className="text-xl font-semibold text-brand-900">
            {isEdit ? strings.reminderForm.editTitle : strings.reminderForm.createTitle}
          </Text>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.typeHeading}</Text>
            <View className="flex-row flex-wrap">
              {REMINDER_TYPES.map((option) => (
                <Text
                  key={option}
                  testID={`reminder-type-${option}`}
                  onPress={() => setType(option)}
                  className={
                    type === option
                      ? "mb-2 mr-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
                      : "mb-2 mr-2 rounded-lg border border-brand-100 px-3 py-2 text-sm text-brand-900"
                  }
                >
                  {option}
                </Text>
              ))}
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.titleLabel}</Text>
            <TextInput
              testID="reminder-title-input"
              value={title}
              onChangeText={setTitle}
              placeholder={strings.reminderForm.titlePlaceholder}
              className="rounded-lg border border-brand-100 px-4 py-3 text-base text-brand-900"
            />
          </View>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.scheduleHeading}</Text>
            <ScheduleBuilder value={schedule} onChange={setSchedule} />
          </View>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.startDateLabel}</Text>
            <View className="flex-row items-center gap-2">
              <Text
                testID="reminder-startdate-minus1w"
                onPress={() => setStartDate((d) => shiftDateString(d, -7))}
                className="rounded-lg border border-brand-100 px-2 py-1 text-sm text-brand-900"
              >
                -1w
              </Text>
              <Text
                testID="reminder-startdate-minus1d"
                onPress={() => setStartDate((d) => shiftDateString(d, -1))}
                className="rounded-lg border border-brand-100 px-2 py-1 text-sm text-brand-900"
              >
                -1d
              </Text>
              <Text testID="reminder-startdate" className="text-sm font-semibold text-brand-900">
                {startDate}
              </Text>
              <Text
                testID="reminder-startdate-plus1d"
                onPress={() => setStartDate((d) => shiftDateString(d, 1))}
                className="rounded-lg border border-brand-100 px-2 py-1 text-sm text-brand-900"
              >
                +1d
              </Text>
              <Text
                testID="reminder-startdate-plus1w"
                onPress={() => setStartDate((d) => shiftDateString(d, 7))}
                className="rounded-lg border border-brand-100 px-2 py-1 text-sm text-brand-900"
              >
                +1w
              </Text>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.timeLabel}</Text>
            <ScrollView horizontal testID="reminder-time-list">
              {TIME_OF_DAY_OPTIONS.map((time) => (
                <Text
                  key={time}
                  testID={`reminder-time-${time}`}
                  onPress={() => setTimeOfDay(time)}
                  className={
                    time === timeOfDay
                      ? "mr-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
                      : "mr-2 rounded-lg border border-brand-100 px-3 py-2 text-sm text-brand-900"
                  }
                >
                  {time}
                </Text>
              ))}
            </ScrollView>
          </View>

          <PrimaryButton
            testID="reminder-save"
            label={strings.reminderForm.save}
            loading={isSaving}
            onPress={() => void handleSave()}
          />
          {saveError ? (
            <Text testID="reminder-save-error" className="text-center text-sm text-red-600">
              {strings.reminderForm.saveError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
