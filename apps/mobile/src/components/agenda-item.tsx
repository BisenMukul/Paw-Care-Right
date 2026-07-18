import type { AgendaEntry } from "@pawcareright/types";
import { Text, View } from "react-native";

import { strings } from "../strings";
import { Card } from "./card";
import { PrimaryButton } from "./primary-button";
import { SecondaryButton } from "./secondary-button";

export interface AgendaItemProps {
  entry: AgendaEntry;
  onComplete: () => void;
  onSnooze: () => void;
}

/** Deterministic UTC-slice HH:mm (mirrors `care-plan/[petId].tsx`'s `formatDate` slicing pattern -- no `Intl` formatting needed here). */
function formatDueTime(iso: string): string {
  return iso.slice(11, 16);
}

/**
 * `AgendaItem` (T060 plan): a presentational agenda row -- title, type
 * label, due time, status badge, and `Mark done`/`Snooze` actions. All
 * callbacks come from the screen (no data fetching here). A `DONE`
 * occurrence renders a disabled/updated visual with no actions.
 */
export function AgendaItem({ entry, onComplete, onSnooze }: AgendaItemProps) {
  const dueAtMs = new Date(entry.dueAt).getTime();
  const isDone = entry.status === "DONE";

  return (
    <Card
      testID={`agenda-item-${entry.reminderId}-${dueAtMs}`}
      {...(isDone ? { className: "opacity-60" } : {})}
    >
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-base font-semibold text-brand-900">{entry.title}</Text>
        <Text className="text-sm text-brand-700">{formatDueTime(entry.dueAt)}</Text>
      </View>
      <Text className="text-sm text-brand-700">{strings.agenda.typeLabel(entry.type)}</Text>

      {entry.medDoseAsEntered !== undefined ? (
        <Text
          testID={`agenda-item-dose-${entry.reminderId}-${dueAtMs}`}
          className="text-sm text-brand-700"
        >
          {strings.agenda.medDoseLabel}: {entry.medDoseAsEntered}
        </Text>
      ) : null}

      {entry.status === "DONE" ? (
        <Text
          testID={`agenda-item-status-${entry.reminderId}-${dueAtMs}`}
          className="text-xs font-semibold text-brand-700"
        >
          {strings.agenda.statusDone}
        </Text>
      ) : null}
      {entry.status === "SNOOZED" ? (
        <Text
          testID={`agenda-item-status-${entry.reminderId}-${dueAtMs}`}
          className="text-xs font-semibold text-brand-700"
        >
          {strings.agenda.statusSnoozed}
        </Text>
      ) : null}

      {!isDone ? (
        <View className="flex-row gap-2">
          <PrimaryButton
            testID={`agenda-item-complete-${entry.reminderId}-${dueAtMs}`}
            label={strings.agenda.markDone}
            onPress={onComplete}
          />
          <SecondaryButton
            testID={`agenda-item-snooze-${entry.reminderId}-${dueAtMs}`}
            label={strings.agenda.snooze}
            onPress={onSnooze}
          />
        </View>
      ) : null}
    </Card>
  );
}
