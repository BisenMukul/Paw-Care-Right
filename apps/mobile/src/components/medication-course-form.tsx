import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useCreateMedicationCourse } from "../api/reminders-api";
import { strings } from "../strings";
import { PrimaryButton } from "./primary-button";

/** Same 30-minute option-list pattern as `reminders/edit.tsx`'s `TIME_OF_DAY_OPTIONS` (duplicated locally per plan -- no new dependency). */
const TIME_OF_DAY_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

const MIN_COURSE_LENGTH_DAYS = 1;
const MAX_COURSE_LENGTH_DAYS = 365;
/** A default TIME (schedule cadence), never a default DOSE (CLAUDE §7 rule 2 -- plan "Files to create/modify"). */
const DEFAULT_DOSE_TIME = "09:00";
const DEFAULT_COURSE_LENGTH_DAYS = 1;

const DEVICE_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const STEPPER_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
const SELECTED_CHIP_CLASS = "mr-2 min-h-[44px] justify-center rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white";
const UNSELECTED_CHIP_CLASS = "mr-2 min-h-[44px] justify-center rounded-lg border border-brand-100 px-3 py-2 text-sm text-brand-900";
const STEPPER_CLASS = "min-h-[44px] justify-center rounded-lg border border-brand-100 px-2 py-1 text-sm text-brand-900";

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

/** `noUncheckedIndexedAccess`-safe `YYYY-MM-DD` parse (mirrors `reminders/edit.tsx`). */
function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year: year ?? 1970, month: month ?? 1, day: day ?? 1 };
}

/** `noUncheckedIndexedAccess`-safe `HH:mm` parse (mirrors `reminders/edit.tsx`). */
function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

/** Pure calendar-day shift on a `YYYY-MM-DD` string (mirrors `reminders/edit.tsx`'s `shiftDateString`). */
function shiftDateString(dateStr: string, days: number): string {
  const { year, month, day } = parseDateString(dateStr);
  const shifted = new Date(year, month - 1, day);
  shifted.setDate(shifted.getDate() + days);
  return dateStringFromDate(shifted);
}

/** Combines a `YYYY-MM-DD` date and an `HH:mm` time as LOCAL wall-clock, then converts to UTC ISO (mirrors `reminders/edit.tsx`'s `combineLocalDateTime`). */
function combineLocalDateTime(dateStr: string, timeStr: string): string {
  const { year, month, day } = parseDateString(dateStr);
  const { hour, minute } = parseTimeString(timeStr);
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function clampCourseLength(n: number): number {
  return Math.min(MAX_COURSE_LENGTH_DAYS, Math.max(MIN_COURSE_LENGTH_DAYS, n));
}

export interface MedicationCourseFormProps {
  petId: string;
  onSaved: () => void;
}

/**
 * `MedicationCourseForm` (T061 plan "Files to create/modify"): free-text
 * name + dose (a RECORD of what the vet prescribed, never a suggestion --
 * CLAUDE §7 rule 2), a per-dose-time list with an "Add time" control, a
 * course-length (days) stepper, and a start-date stepper. No autocomplete,
 * no dose presets, no default dose -- the always-visible static disclaimer
 * is non-dismissible copy sourced from the `MEDICATION_STATIC_COPY` SSOT
 * (via `strings.medForm`). Token-only sweep (SWEEP-4 plan): colors/radius/
 * 44pt only -- ZERO copy/field/label/placeholder/disclaimer change.
 */
export function MedicationCourseForm({ petId, onSaved }: MedicationCourseFormProps) {
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [doseTimes, setDoseTimes] = useState<string[]>([DEFAULT_DOSE_TIME]);
  const [courseLengthDays, setCourseLengthDays] = useState(DEFAULT_COURSE_LENGTH_DAYS);
  const [startDate, setStartDate] = useState(todayDateString());
  const [saveError, setSaveError] = useState(false);

  const createMutation = useCreateMedicationCourse(petId);

  function addTime() {
    setDoseTimes((times) => [...times, DEFAULT_DOSE_TIME]);
  }

  function setTimeAt(index: number, time: string) {
    setDoseTimes((times) => times.map((t, i) => (i === index ? time : t)));
  }

  async function handleSave() {
    setSaveError(false);
    const doseStartAts = doseTimes.map((time) => combineLocalDateTime(startDate, time));

    try {
      await createMutation.mutateAsync({
        medNameAsEntered: medName,
        ...(medDose.length > 0 ? { medDoseAsEntered: medDose } : {}),
        doseStartAts,
        courseLengthDays,
        timezone: DEVICE_TIMEZONE,
      });
      onSaved();
    } catch {
      setSaveError(true);
    }
  }

  return (
    <View className="gap-6">
      <Text className="text-base font-semibold text-brand-900">{strings.medForm.heading}</Text>

      <View className="gap-2">
        <Text className="text-base font-semibold text-brand-900">{strings.medForm.nameLabel}</Text>
        <TextInput
          testID="med-name-input"
          value={medName}
          onChangeText={setMedName}
          placeholder={strings.medForm.namePlaceholder}
          placeholderTextColor="#2f8f74"
          className="rounded-lg border border-brand-100 px-4 py-3 text-base text-brand-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-base font-semibold text-brand-900">{strings.medForm.doseLabel}</Text>
        <TextInput
          testID="med-dose-input"
          value={medDose}
          onChangeText={setMedDose}
          placeholder={strings.medForm.dosePlaceholder}
          placeholderTextColor="#2f8f74"
          className="rounded-lg border border-brand-100 px-4 py-3 text-base text-brand-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-base font-semibold text-brand-900">{strings.medForm.doseTimesLabel}</Text>
        {doseTimes.map((selected, index) => (
          <ScrollView horizontal key={index} testID={`med-time-row-${index}`}>
            {TIME_OF_DAY_OPTIONS.map((time) => (
              <Text
                key={time}
                testID={`med-time-${index}-${time}`}
                onPress={() => setTimeAt(index, time)}
                className={time === selected ? SELECTED_CHIP_CLASS : UNSELECTED_CHIP_CLASS}
              >
                {time}
              </Text>
            ))}
          </ScrollView>
        ))}
        <Text testID="med-add-time" onPress={addTime} className={STEPPER_CLASS}>
          {strings.medForm.addTimeLabel}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-base font-semibold text-brand-900">{strings.medForm.courseLengthLabel}</Text>
        <View className="flex-row items-center gap-3">
          <Pressable
            testID="med-course-length-minus"
            onPress={() => setCourseLengthDays((n) => clampCourseLength(n - 1))}
            hitSlop={STEPPER_HIT_SLOP}
            className={STEPPER_CLASS}
          >
            <Text className="text-sm text-brand-900">-</Text>
          </Pressable>
          <Text testID="med-course-length" className="text-base font-semibold text-brand-900">
            {courseLengthDays}
          </Text>
          <Pressable
            testID="med-course-length-plus"
            onPress={() => setCourseLengthDays((n) => clampCourseLength(n + 1))}
            hitSlop={STEPPER_HIT_SLOP}
            className={STEPPER_CLASS}
          >
            <Text className="text-sm text-brand-900">+</Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-base font-semibold text-brand-900">{strings.reminderForm.startDateLabel}</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            testID="med-startdate-minus1w"
            onPress={() => setStartDate((d) => shiftDateString(d, -7))}
            hitSlop={STEPPER_HIT_SLOP}
            className={STEPPER_CLASS}
          >
            <Text className="text-sm text-brand-900">-1w</Text>
          </Pressable>
          <Pressable
            testID="med-startdate-minus1d"
            onPress={() => setStartDate((d) => shiftDateString(d, -1))}
            hitSlop={STEPPER_HIT_SLOP}
            className={STEPPER_CLASS}
          >
            <Text className="text-sm text-brand-900">-1d</Text>
          </Pressable>
          <Text testID="med-startdate" className="text-sm font-semibold text-brand-900">
            {startDate}
          </Text>
          <Pressable
            testID="med-startdate-plus1d"
            onPress={() => setStartDate((d) => shiftDateString(d, 1))}
            hitSlop={STEPPER_HIT_SLOP}
            className={STEPPER_CLASS}
          >
            <Text className="text-sm text-brand-900">+1d</Text>
          </Pressable>
          <Pressable
            testID="med-startdate-plus1w"
            onPress={() => setStartDate((d) => shiftDateString(d, 7))}
            hitSlop={STEPPER_HIT_SLOP}
            className={STEPPER_CLASS}
          >
            <Text className="text-sm text-brand-900">+1w</Text>
          </Pressable>
        </View>
      </View>

      <Text testID="med-disclaimer" className="text-center text-sm text-brand-700">
        {strings.medForm.disclaimer}
      </Text>

      <PrimaryButton
        testID="med-course-save"
        label={strings.medForm.save}
        loading={createMutation.isPending}
        onPress={() => void handleSave()}
      />
      {saveError ? (
        <Text testID="med-course-save-error" className="text-center text-sm text-red-700">
          {strings.reminderForm.saveError}
        </Text>
      ) : null}
    </View>
  );
}
