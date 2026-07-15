import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { parseRRule } from "@pawcareright/types";
import { Prisma } from "@prisma/client";
import type { Queue } from "bullmq";

import { PrismaService } from "../prisma/prisma.service";
import { computeNextFireAt } from "../reminders/next-fire-at";
import { occurrencesBetween } from "../reminders/occurrences-between";
import { PUSH_JOB_NAME, PUSH_QUEUE, type PushJobData } from "./push.contract";

/**
 * Backfill window (T056 plan decision 4): missed occurrences older than this
 * are never materialized/pushed on boot -- only advanced past, so a restart
 * never floods pushes.
 */
export const BACKFILL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** `true` iff `e` is a Prisma unique-constraint violation (P2002) -- mirrors `households.service.ts`. */
export function isUniqueConstraintViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** The subset of `Reminder` columns the tick/backfill cursor scan needs. */
interface ReminderCursorRow {
  id: string;
  rrule: string;
  timezone: string;
  startAt: Date;
  nextFireAt: Date;
}

/**
 * `ReminderSchedulerService` (T056): all the tick/backfill business logic,
 * consuming T053's `computeNextFireAt` / T055's `occurrencesBetween`
 * unchanged. `tick`/`backfill` take an injectable `now: Date` so fake-clock
 * unit tests exercise every code path without touching BullMQ's real clock
 * (plan "Risks & decisions" #1). Never logs reminder `title`/`type`/
 * `medNameAsEntered` (user content) -- every log object is id/count-keyed
 * only (plan Safety statement).
 */
@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PUSH_QUEUE) private readonly pushQueue: Queue<PushJobData>,
  ) {}

  /**
   * Fire mode (plan "Tick semantics"): materialize the due `ReminderEvent`
   * (idempotent on the `(reminderId, dueAt)` unique constraint), enqueue a
   * push job only for a freshly-created event, then advance `nextFireAt` to
   * the next occurrence (or deactivate on series exhaustion). Each reminder
   * is isolated in its own try/catch so one failure never blocks the rest of
   * the tick.
   */
  async tick(now: Date): Promise<void> {
    const reminders: ReminderCursorRow[] = await this.prisma.reminder.findMany({
      where: { active: true, nextFireAt: { lte: now } },
      select: { id: true, rrule: true, timezone: true, startAt: true, nextFireAt: true },
    });

    let fired = 0;
    let skippedDuplicate = 0;
    let failed = 0;

    for (const reminder of reminders) {
      try {
        const parsed = parseRRule(reminder.rrule);
        if (!parsed.ok) {
          // Defensive: rrule is validated on write, should not happen.
          this.logger.warn({ event: "reminder_tick_parse_failed", reminderId: reminder.id });
          continue;
        }

        const dueAt = reminder.nextFireAt;

        let createdEventId: string | null = null;
        try {
          const event = await this.prisma.reminderEvent.create({
            data: { reminderId: reminder.id, dueAt, status: "SENT", sentAt: now },
          });
          createdEventId = event.id;
        } catch (err) {
          if (!isUniqueConstraintViolation(err)) throw err;
          // A duplicate/redelivered tick for an already-materialized due
          // instant -- do NOT push again.
          skippedDuplicate += 1;
        }

        if (createdEventId !== null) {
          try {
            await this.pushQueue.add(
              PUSH_JOB_NAME,
              { reminderEventId: createdEventId },
              {
                jobId: createdEventId,
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 5,
                backoff: { type: "exponential", delay: 30_000 },
              },
            );
          } catch {
            // Best-effort: a queue failure never undoes the already-created
            // event (mirrors `scheduleFollowUp` in `check-runner.processor.ts`).
            this.logger.warn({ event: "push_enqueue_failed", reminderId: reminder.id, eventId: createdEventId });
          }
          fired += 1;
        }

        const next = computeNextFireAt(
          parsed.value,
          reminder.startAt,
          new Date(dueAt.getTime() + 1),
          reminder.timezone,
        );

        if (next !== null) {
          // Guarded on `nextFireAt: dueAt` -- a concurrent/duplicate tick's
          // advance becomes a 0-row no-op, and a prior tick that crashed
          // before advancing can still recover on the next tick.
          await this.prisma.reminder.updateMany({
            where: { id: reminder.id, nextFireAt: dueAt },
            data: { nextFireAt: next },
          });
        } else {
          await this.prisma.reminder.updateMany({
            where: { id: reminder.id, nextFireAt: dueAt },
            data: { active: false },
          });
          this.logger.log({ event: "reminder_series_exhausted", reminderId: reminder.id });
        }
      } catch {
        failed += 1;
        this.logger.error({ event: "reminder_fire_failed", reminderId: reminder.id });
      }
    }

    this.logger.log({ event: "reminder_tick_done", due: reminders.length, fired, skippedDuplicate, failed });
  }

  /**
   * Boot-time catch-up (plan "Backfill semantics"): occurrences missed while
   * the worker was down are materialized as `MISSED` ONLY within the last
   * `BACKFILL_WINDOW_MS` -- never pushed -- and `nextFireAt` is advanced
   * strictly past `now` so the very next minute-tick fires only genuinely
   * fresh occurrences. Occurrences older than the window are never
   * enumerated (skipped) -- that is the "no flood on restart" behavior.
   */
  async backfill(now: Date): Promise<void> {
    const reminders: ReminderCursorRow[] = await this.prisma.reminder.findMany({
      where: { active: true, nextFireAt: { lte: now } },
      select: { id: true, rrule: true, timezone: true, startAt: true, nextFireAt: true },
    });

    let missedCreated = 0;
    let deactivated = 0;

    for (const reminder of reminders) {
      try {
        const parsed = parseRRule(reminder.rrule);
        if (!parsed.ok) {
          this.logger.warn({ event: "reminder_backfill_parse_failed", reminderId: reminder.id });
          continue;
        }

        const from = new Date(Math.max(reminder.nextFireAt.getTime(), now.getTime() - BACKFILL_WINDOW_MS));
        const missed = occurrencesBetween(parsed.value, reminder.startAt, reminder.timezone, from, now);

        for (const dueAt of missed) {
          try {
            await this.prisma.reminderEvent.create({
              data: { reminderId: reminder.id, dueAt, status: "MISSED" },
            });
            missedCreated += 1;
          } catch (err) {
            if (!isUniqueConstraintViolation(err)) throw err;
          }
        }

        const next = computeNextFireAt(parsed.value, reminder.startAt, new Date(now.getTime() + 1), reminder.timezone);

        if (next !== null) {
          await this.prisma.reminder.updateMany({ where: { id: reminder.id }, data: { nextFireAt: next } });
        } else {
          await this.prisma.reminder.updateMany({ where: { id: reminder.id }, data: { active: false } });
          deactivated += 1;
        }
      } catch {
        this.logger.error({ event: "reminder_backfill_failed", reminderId: reminder.id });
      }
    }

    this.logger.log({ event: "reminder_backfill_done", behind: reminders.length, missedCreated, deactivated });
  }

  /**
   * Snooze re-fire pass (T060 plan decision 4): scans
   * `ReminderEvent where status = SNOOZED and snoozedUntil <= now` (backed
   * by the `[status, snoozedUntil]` index) and, for each, ATOMICALLY flips
   * `SNOOZED -> SENT` via a guarded `updateMany` keyed on the event's own
   * `id` + its still-`SNOOZED` status + a due `snoozedUntil`. Only a
   * `count === 1` result enqueues a push -- a concurrent/duplicate
   * invocation's flip becomes a 0-row no-op, so this can never double-fire.
   * Never rewinds/advances `Reminder.nextFireAt` (that column is untouched
   * here entirely) and never re-derives `dueAt` (the original occurrence
   * instant is preserved). Per-event try/catch mirrors `tick`/`backfill`;
   * logs are id/count-keyed only (no title/type/medNameAsEntered).
   */
  async refireSnoozed(now: Date): Promise<void> {
    const snoozed = await this.prisma.reminderEvent.findMany({
      where: { status: "SNOOZED", snoozedUntil: { lte: now } },
      select: { id: true },
    });

    let refired = 0;
    let failed = 0;

    for (const event of snoozed) {
      try {
        const { count } = await this.prisma.reminderEvent.updateMany({
          where: { id: event.id, status: "SNOOZED", snoozedUntil: { lte: now } },
          data: { status: "SENT", sentAt: now, snoozedUntil: null },
        });

        if (count === 1) {
          try {
            await this.pushQueue.add(
              PUSH_JOB_NAME,
              { reminderEventId: event.id },
              {
                jobId: `${event.id}:snooze:${Math.floor(now.getTime() / 60_000)}`,
                removeOnComplete: true,
                removeOnFail: false,
                attempts: 5,
                backoff: { type: "exponential", delay: 30_000 },
              },
            );
          } catch {
            this.logger.warn({ event: "push_enqueue_failed", eventId: event.id });
          }
          refired += 1;
        }
      } catch {
        failed += 1;
        this.logger.error({ event: "refire_snoozed_failed", eventId: event.id });
      }
    }

    this.logger.log({ event: "refire_snoozed_done", due: snoozed.length, refired, failed });
  }
}
