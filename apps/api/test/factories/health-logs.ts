import type { HealthLogKind } from "@pawcareright/types";
import type { HealthLog, Prisma, PrismaClient, ReminderEvent } from "@prisma/client";

/**
 * Health-log test factories (T070 plan decision 3): pure per-kind `valueJson`
 * builders plus DB seed helpers, consolidating the ~20-line Reminder +
 * ReminderEvent seed block that used to be duplicated across
 * `filter_by_each_kind` and `vet-summary` in `health-logs.e2e-spec.ts`, and
 * the direct CHECK_REF `healthLog.create` call.
 */

export const logValue = {
  weight: (weightGrams: number) => ({ weightGrams }),
  meal: (note: string) => ({ note }),
  note: (text: string) => ({ text }),
  vetVisit: (reason: string) => ({ reason }),
  checkRef: (checkId: string) => ({ checkId }),
};

export async function createHealthLog(
  prisma: PrismaClient,
  petId: string,
  args: { kind: HealthLogKind | string; valueJson: Record<string, unknown>; occurredAt: string | Date },
): Promise<HealthLog> {
  return prisma.healthLog.create({
    data: {
      petId,
      kind: args.kind as HealthLogKind,
      valueJson: args.valueJson as unknown as Prisma.InputJsonValue,
      occurredAt: new Date(args.occurredAt),
    },
  });
}

/**
 * Seeds a completed `MEDICATION` reminder + its `DONE` `ReminderEvent` -- the
 * source rows the service's MED_GIVEN read-time projection reads (plan
 * decision 3). Mirrors the exact fields the two inline e2e blocks set.
 */
export async function seedCompletedMedication(
  prisma: PrismaClient,
  petId: string,
  opts: { at: string | Date; medNameAsEntered?: string; medDoseAsEntered?: string },
): Promise<ReminderEvent> {
  const at = new Date(opts.at);
  const reminder = await prisma.reminder.create({
    data: {
      petId,
      type: "MEDICATION",
      title: "Antibiotic",
      rrule: "FREQ=DAILY",
      timezone: "UTC",
      startAt: at,
      nextFireAt: at,
      medNameAsEntered: opts.medNameAsEntered ?? "As prescribed",
      ...(opts.medDoseAsEntered !== undefined ? { medDoseAsEntered: opts.medDoseAsEntered } : {}),
    },
  });

  return prisma.reminderEvent.create({
    data: {
      reminderId: reminder.id,
      dueAt: at,
      status: "DONE",
      completedAt: at,
    },
  });
}
