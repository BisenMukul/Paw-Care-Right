import { RRULE_WEEKDAYS, type RRuleWeekday } from "@pawcareright/types";
import { Text, View } from "react-native";

import type { ScheduleConfig, ScheduleFrequency } from "../reminders/schedule-builder";
import { strings } from "../strings";

export interface ScheduleBuilderProps {
  value: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
}

const FREQ_OPTIONS: ScheduleFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];
const MIN_INTERVAL = 1;
const MAX_INTERVAL = 30;
const MIN_MONTH_DAY = 1;
const MAX_MONTH_DAY = 31;

const SELECTED_CLASS = "mr-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white";
const UNSELECTED_CLASS = "mr-2 rounded-lg border border-brand-100 px-3 py-2 text-sm text-brand-900";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * `ScheduleBuilder` (T060 plan decision 7 / "Files to create/modify"):
 * controlled UI over the pure `ScheduleConfig` -- freq segmented control,
 * interval stepper (every-N), a WEEKLY-only weekday multi-select, and a
 * MONTHLY-only day-of-month stepper. `buildRRule(config)` is called by the
 * parent form at save time; this component never touches an rrule string.
 */
export function ScheduleBuilder({ value, onChange }: ScheduleBuilderProps) {
  const interval = value.interval ?? 1;

  function selectFreq(freq: ScheduleFrequency) {
    onChange({
      freq,
      interval,
      ...(freq === "WEEKLY" ? { byDay: value.byDay ?? [] } : {}),
      ...(freq === "MONTHLY" ? { byMonthDay: value.byMonthDay ?? 1 } : {}),
    });
  }

  function setInterval(nextInterval: number) {
    onChange({ ...value, interval: clamp(nextInterval, MIN_INTERVAL, MAX_INTERVAL) });
  }

  function toggleDay(day: RRuleWeekday) {
    const current = value.byDay ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    onChange({ ...value, byDay: next });
  }

  function setMonthDay(nextDay: number) {
    onChange({ ...value, byMonthDay: clamp(nextDay, MIN_MONTH_DAY, MAX_MONTH_DAY) });
  }

  return (
    <View className="gap-4">
      <View className="flex-row">
        {FREQ_OPTIONS.map((freq) => (
          <Text
            key={freq}
            testID={`schedule-freq-${freq}`}
            onPress={() => selectFreq(freq)}
            className={value.freq === freq ? SELECTED_CLASS : UNSELECTED_CLASS}
          >
            {strings.reminderForm.freqLabel(freq)}
          </Text>
        ))}
      </View>

      <View className="flex-row items-center gap-3">
        <Text className="text-sm text-brand-900">{strings.reminderForm.intervalLabel}</Text>
        <Text
          testID="schedule-interval-decrement"
          onPress={() => setInterval(interval - 1)}
          className={UNSELECTED_CLASS}
        >
          -
        </Text>
        <Text testID="schedule-interval" className="text-base font-semibold text-brand-900">
          {interval}
        </Text>
        <Text
          testID="schedule-interval-increment"
          onPress={() => setInterval(interval + 1)}
          className={UNSELECTED_CLASS}
        >
          +
        </Text>
      </View>

      {value.freq === "WEEKLY" ? (
        <View testID="schedule-day-row" className="flex-row flex-wrap">
          {RRULE_WEEKDAYS.map((day) => (
            <Text
              key={day}
              testID={`schedule-day-${day}`}
              onPress={() => toggleDay(day)}
              className={(value.byDay ?? []).includes(day) ? SELECTED_CLASS : UNSELECTED_CLASS}
            >
              {day}
            </Text>
          ))}
        </View>
      ) : null}

      {value.freq === "MONTHLY" ? (
        <View className="flex-row items-center gap-3">
          <Text className="text-sm text-brand-900">{strings.reminderForm.monthDayLabel}</Text>
          <Text
            testID="schedule-monthday-decrement"
            onPress={() => setMonthDay((value.byMonthDay ?? 1) - 1)}
            className={UNSELECTED_CLASS}
          >
            -
          </Text>
          <Text testID="schedule-monthday" className="text-base font-semibold text-brand-900">
            {value.byMonthDay ?? 1}
          </Text>
          <Text
            testID="schedule-monthday-increment"
            onPress={() => setMonthDay((value.byMonthDay ?? 1) + 1)}
            className={UNSELECTED_CLASS}
          >
            +
          </Text>
        </View>
      ) : null}
    </View>
  );
}
