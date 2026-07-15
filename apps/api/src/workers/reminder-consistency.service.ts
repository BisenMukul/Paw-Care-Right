import { Injectable, Logger } from "@nestjs/common";
import { parseRRule } from "@pawcareright/types";

import { PrismaService } from "../prisma/prisma.service";
import { occurrencesBetween } from "../reminders/occurrences-between";

/** Bounded scan window (T062 plan decision 2/4): "household-agnostic full scan, bounded 24h window". */
export const CONSISTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Skirt on the "missing materialization" side (T062 plan decision 3 / Risk
 * R4): a just-due predicted occurrence the minute-tick hasn't yet had time
 * to materialize is not flagged missing until it's this old.
 */
export const CONSISTENCY_GRACE_MS = 5 * 60 * 1000;

export interface ConsistencyDiscrepancy {
  reminderId: string;
  dueAtEpochMs: number;
  eventId?: string; // present for orphan-event class
  kind: "orphan_event" | "missing_materialization";
}

export interface ConsistencyReport {
  from: Date;
  to: Date; // === now
  remindersScanned: number;
  predictedInWindow: number;
  materializedInWindow: number;
  discrepancies: ConsistencyDiscrepancy[];
}

/** The `ReminderEvent` statuses considered "materialized" (T062 plan interfaces/contracts). */
const MATERIALIZED_STATUSES = new Set(["SENT", "DONE", "MISSED", "SNOOZED"]);

interface ReminderConsistencyRow {
  id: string;
  rrule: string;
  timezone: string;
  startAt: Date;
}

interface ReminderEventConsistencyRow {
  id: string;
  reminderId: string;
  dueAt: Date;
  status: string;
}

/**
 * `ReminderConsistencyService` (T062 plan decisions 2/3/4): a log-only,
 * household-agnostic "agenda vs fired-event" drift detector. Compares the
 * PREDICTED occurrence set (`occurrencesBetween`, mirroring
 * `RemindersService.agenda`'s own expansion) against the MATERIALIZED
 * `ReminderEvent` set over a bounded trailing window, keyed on the EXACT
 * `${reminderId}:${dueAt.getTime()}` merge key the agenda already uses.
 * Never writes/updates/deletes any row -- structured `ConsistencyReport` is
 * the sole output; the processor logs a summary + one id-only line per
 * discrepancy. Scans ALL reminders (active and inactive; `occurrencesBetween`
 * already respects `COUNT`/`UNTIL` so an exhausted/deactivated series
 * self-limits) -- no household batching (plan decision 4 / Risk R5).
 */
@Injectable()
export class ReminderConsistencyService {
  private readonly logger = new Logger(ReminderConsistencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkConsistency(now: Date): Promise<ConsistencyReport> {
    const from = new Date(now.getTime() - CONSISTENCY_WINDOW_MS);

    const reminders: ReminderConsistencyRow[] = await this.prisma.reminder.findMany({
      select: { id: true, rrule: true, timezone: true, startAt: true },
    });

    const predicted = new Map<string, { reminderId: string; dueAtEpochMs: number }>();

    for (const reminder of reminders) {
      const parsed = parseRRule(reminder.rrule);
      if (!parsed.ok) {
        // Defensive: rrule is validated on write, should not happen.
        this.logger.warn({ event: "reminder_consistency_parse_failed", reminderId: reminder.id });
        continue;
      }

      const occurrences = occurrencesBetween(parsed.value, reminder.startAt, reminder.timezone, from, now);
      for (const dueAt of occurrences) {
        predicted.set(`${reminder.id}:${dueAt.getTime()}`, { reminderId: reminder.id, dueAtEpochMs: dueAt.getTime() });
      }
    }

    const events: ReminderEventConsistencyRow[] = await this.prisma.reminderEvent.findMany({
      where: { dueAt: { gte: from, lte: now } },
      select: { id: true, reminderId: true, dueAt: true, status: true },
    });

    const materializedKeys = new Set<string>();
    const discrepancies: ConsistencyDiscrepancy[] = [];

    for (const event of events) {
      const key = `${event.reminderId}:${event.dueAt.getTime()}`;
      materializedKeys.add(key);

      if (MATERIALIZED_STATUSES.has(event.status) && !predicted.has(key)) {
        discrepancies.push({
          reminderId: event.reminderId,
          dueAtEpochMs: event.dueAt.getTime(),
          eventId: event.id,
          kind: "orphan_event",
        });
      }
    }

    const graceCutoffMs = now.getTime() - CONSISTENCY_GRACE_MS;
    for (const [key, occurrence] of predicted) {
      if (occurrence.dueAtEpochMs <= graceCutoffMs && !materializedKeys.has(key)) {
        discrepancies.push({
          reminderId: occurrence.reminderId,
          dueAtEpochMs: occurrence.dueAtEpochMs,
          kind: "missing_materialization",
        });
      }
    }

    const orphanCount = discrepancies.filter((d) => d.kind === "orphan_event").length;
    const missingCount = discrepancies.filter((d) => d.kind === "missing_materialization").length;

    this.logger.log({
      event: "reminder_consistency_check_done",
      remindersScanned: reminders.length,
      predictedInWindow: predicted.size,
      materializedInWindow: events.length,
      orphanCount,
      missingCount,
    });

    for (const discrepancy of discrepancies) {
      this.logger.warn({
        event: "reminder_consistency_discrepancy",
        kind: discrepancy.kind,
        reminderId: discrepancy.reminderId,
        dueAtEpochMs: discrepancy.dueAtEpochMs,
        ...(discrepancy.eventId !== undefined ? { eventId: discrepancy.eventId } : {}),
      });
    }

    return {
      from,
      to: now,
      remindersScanned: reminders.length,
      predictedInWindow: predicted.size,
      materializedInWindow: events.length,
      discrepancies,
    };
  }
}
