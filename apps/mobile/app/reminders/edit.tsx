import { useIsOffline } from "@pawcareright/api-client";
import { REMINDER_TYPES } from "@pawcareright/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCreateReminder, useReminder, useUpdateReminder } from "../../src/api/reminders-api";
import { Card } from "../../src/components/card";
import { Chip } from "../../src/components/chip";
import { MedicationCourseForm } from "../../src/components/medication-course-form";
import { PrimaryButton } from "../../src/components/primary-button";
import { ScheduleBuilder } from "../../src/components/schedule-builder";
import { ScreenScaffold } from "../../src/components/screen-scaffold";
import { Skeleton } from "../../src/components/skeleton";
import { TextField } from "../../src/components/text-field";
import { buildRRule, parseRRuleToScheduleConfig, type ScheduleConfig } from "../../src/reminders/schedule-builder";
import { strings } from "../../src/strings";

const DEFAULT_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Same 30-minute option-list pattern as `settings/notifications.tsx`'s `QUIET_TIME_OPTIONS` (T060 plan) -- no new dependency. */
const TIME_OF_DAY_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

const STEPPER_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
const STEPPER_CLASS = "min-h-[44px] justify-center rounded-lg border border-brand-100 px-2 py-1";

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
 * field, no dose/drug-name copy anywhere on this generic form (plan Safety
 * statement) -- editing any EXISTING reminder (including MEDICATION ones)
 * only records the user's own title, exactly like every other type.
 *
 * T061: in CREATE mode only, selecting `type: MEDICATION` swaps the
 * title/schedule/start-date/time/save block for `MedicationCourseForm` --
 * free-text name+dose (a RECORD of what the vet prescribed, never a
 * suggestion -- CLAUDE §7 rule 2) plus a per-dose-time course. Med-course
 * editing is out of scope (plan "Out of scope").
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
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Card testID="reminder-form-loading">
          <Skeleton lines={3} />
        </Card>
        <Text className="text-center text-base text-brand-900">{strings.reminderForm.loading}</Text>
      </SafeAreaView>
    );
  }

  if (isEdit && isOffline && !existing) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="reminder-form-offline" className="text-center text-base text-brand-900">
          {strings.reminderForm.error}
        </Text>
        <PrimaryButton testID="reminder-form-retry" label={strings.reminderForm.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  if (isEdit && isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-brand-50 px-6">
        <Text testID="reminder-form-error" className="text-center text-base text-red-700">
          {strings.reminderForm.error}
        </Text>
        <PrimaryButton testID="reminder-form-retry" label={strings.reminderForm.retry} onPress={() => refetch()} />
      </SafeAreaView>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  // T061 plan: only in CREATE mode does selecting MEDICATION swap in the
  // med-course form -- editing an existing reminder (including MEDICATION
  // ones) is unchanged (out of scope).
  const showMedicationForm = !isEdit && type === "MEDICATION";

  return (
    <ScreenScaffold
      title={isEdit ? strings.reminderForm.editTitle : strings.reminderForm.createTitle}
      scrollTestID="reminder-form-scroll"
      {...(!showMedicationForm
        ? {
            footer: (
              <>
                <PrimaryButton
                  testID="reminder-save"
                  label={strings.reminderForm.save}
                  loading={isSaving}
                  onPress={() => void handleSave()}
                />
                {saveError ? (
                  <Text testID="reminder-save-error" className="text-center text-sm text-red-700">
                    {strings.reminderForm.saveError}
                  </Text>
                ) : null}
              </>
            ),
          }
        : {})}
    >
      <View className="gap-2">
        <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.typeHeading}</Text>
        <View className="flex-row flex-wrap gap-2">
          {REMINDER_TYPES.map((option) => (
            <Chip
              key={option}
              testID={`reminder-type-${option}`}
              label={option}
              selected={type === option}
              onPress={() => setType(option)}
            />
          ))}
        </View>
      </View>

      {showMedicationForm ? (
        <MedicationCourseForm petId={petId ?? ""} onSaved={() => router.back()} />
      ) : (
        <>
          <TextField
            testID="reminder-title-input"
            label={strings.reminderForm.titleLabel}
            value={title}
            onChangeText={setTitle}
            placeholder={strings.reminderForm.titlePlaceholder}
          />

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.scheduleHeading}</Text>
            <ScheduleBuilder value={schedule} onChange={setSchedule} />
          </View>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.startDateLabel}</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                testID="reminder-startdate-minus1w"
                onPress={() => setStartDate((d) => shiftDateString(d, -7))}
                hitSlop={STEPPER_HIT_SLOP}
                className={STEPPER_CLASS}
              >
                <Text className="text-sm text-brand-900">-1w</Text>
              </Pressable>
              <Pressable
                testID="reminder-startdate-minus1d"
                onPress={() => setStartDate((d) => shiftDateString(d, -1))}
                hitSlop={STEPPER_HIT_SLOP}
                className={STEPPER_CLASS}
              >
                <Text className="text-sm text-brand-900">-1d</Text>
              </Pressable>
              <Text testID="reminder-startdate" className="text-sm font-semibold text-brand-900">
                {startDate}
              </Text>
              <Pressable
                testID="reminder-startdate-plus1d"
                onPress={() => setStartDate((d) => shiftDateString(d, 1))}
                hitSlop={STEPPER_HIT_SLOP}
                className={STEPPER_CLASS}
              >
                <Text className="text-sm text-brand-900">+1d</Text>
              </Pressable>
              <Pressable
                testID="reminder-startdate-plus1w"
                onPress={() => setStartDate((d) => shiftDateString(d, 7))}
                hitSlop={STEPPER_HIT_SLOP}
                className={STEPPER_CLASS}
              >
                <Text className="text-sm text-brand-900">+1w</Text>
              </Pressable>
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.timeLabel}</Text>
            <ScrollView horizontal testID="reminder-time-list" contentContainerClassName="gap-2">
              {TIME_OF_DAY_OPTIONS.map((time) => (
                <Chip
                  key={time}
                  testID={`reminder-time-${time}`}
                  label={time}
                  selected={time === timeOfDay}
                  onPress={() => setTimeOfDay(time)}
                />
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}
