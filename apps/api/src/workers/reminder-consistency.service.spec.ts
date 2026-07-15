import { Logger } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";
import {
  CONSISTENCY_GRACE_MS,
  CONSISTENCY_WINDOW_MS,
  ReminderConsistencyService,
  type ConsistencyReport,
} from "./reminder-consistency.service";

/**
 * Direct-construct unit tests (T062 plan "Files to create/modify" /
 * "Consistency job" tests): hand-built mock Prisma, `new
 * ReminderConsistencyService(prisma)`, `checkConsistency(now)` called with a
 * fixed `now` -- mirrors `reminder-scheduler.service.spec.ts`. `parseRRule`/
 * `occurrencesBetween` run for REAL; only Prisma reads are mocked. Never
 * asserts on reminder `title`/`type`/`medNameAsEntered` -- the log payload
 * shape is asserted directly (ids/counts only, per plan Safety statement).
 */
describe("ReminderConsistencyService", () => {
  interface ReminderRow {
    id: string;
    rrule: string;
    timezone: string;
    startAt: Date;
  }

  interface EventRow {
    id: string;
    reminderId: string;
    dueAt: Date;
    status: string;
  }

  function buildReminder(overrides: Partial<ReminderRow> = {}): ReminderRow {
    return {
      id: overrides.id ?? "rem-1",
      rrule: overrides.rrule ?? "FREQ=DAILY",
      timezone: overrides.timezone ?? "UTC",
      startAt: overrides.startAt ?? new Date("2026-07-01T09:00:00.000Z"),
    };
  }

  function buildPrisma(opts: { reminders?: ReminderRow[]; events?: EventRow[] }): {
    prisma: PrismaService;
    reminderFindMany: jest.Mock;
    eventFindMany: jest.Mock;
  } {
    const reminderFindMany = jest.fn().mockResolvedValue(opts.reminders ?? []);
    const eventFindMany = jest.fn().mockResolvedValue(opts.events ?? []);
    const prisma = {
      reminder: { findMany: reminderFindMany },
      reminderEvent: { findMany: eventFindMany },
    } as unknown as PrismaService;
    return { prisma, reminderFindMany, eventFindMany };
  }

  it("reports zero discrepancies when every predicted occurrence has a matching event", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const dueAt = new Date("2026-07-14T09:00:00.000Z"); // within the trailing 24h window, an occurrence of FREQ=DAILY 09:00
    const reminder = buildReminder({ startAt: new Date("2026-01-01T09:00:00.000Z") });
    const { prisma } = buildPrisma({
      reminders: [reminder],
      events: [{ id: "event-1", reminderId: "rem-1", dueAt, status: "SENT" }],
    });
    const service = new ReminderConsistencyService(prisma);

    const report = await service.checkConsistency(now);

    expect(report.discrepancies).toEqual([]);
    expect(report.remindersScanned).toBe(1);
    expect(report.predictedInWindow).toBeGreaterThan(0);
    expect(report.materializedInWindow).toBe(1);
    expect(report.from).toEqual(new Date(now.getTime() - CONSISTENCY_WINDOW_MS));
    expect(report.to).toEqual(now);
  });

  it("flags an orphan_event: a SENT event with no predicted occurrence (e.g. a stale post-tz-change event)", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    // FREQ=YEARLY anchored far away -- no occurrence falls in the trailing 24h window.
    const reminder = buildReminder({ rrule: "FREQ=YEARLY", startAt: new Date("2020-01-15T09:00:00.000Z") });
    const orphanDueAt = new Date("2026-07-14T10:00:00.000Z"); // stale event left over from a since-changed rrule/tz
    const { prisma } = buildPrisma({
      reminders: [reminder],
      events: [{ id: "event-orphan", reminderId: "rem-1", dueAt: orphanDueAt, status: "SENT" }],
    });
    const service = new ReminderConsistencyService(prisma);

    const report = await service.checkConsistency(now);

    expect(report.discrepancies).toEqual([
      { reminderId: "rem-1", dueAtEpochMs: orphanDueAt.getTime(), eventId: "event-orphan", kind: "orphan_event" },
    ]);
  });

  it("flags a missing_materialization for a predicted occurrence older than the grace with no event", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    // Anchored so the reminder's occurrence lands exactly 10 minutes ago -- well past the 5min grace.
    const missedDueAt = new Date(now.getTime() - 10 * 60 * 1000);
    const startAt = new Date(
      Date.UTC(2026, 0, 1, missedDueAt.getUTCHours(), missedDueAt.getUTCMinutes(), missedDueAt.getUTCSeconds()),
    );
    const reminder = buildReminder({ startAt });
    const { prisma } = buildPrisma({ reminders: [reminder], events: [] });
    const service = new ReminderConsistencyService(prisma);

    const report = await service.checkConsistency(now);

    expect(report.discrepancies).toEqual([
      { reminderId: "rem-1", dueAtEpochMs: missedDueAt.getTime(), kind: "missing_materialization" },
    ]);
  });

  it("does NOT flag a predicted occurrence inside the grace skirt", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    // Occurrence 2 minutes ago -- inside the 5min grace, not yet flaggable.
    const recentDueAt = new Date(now.getTime() - 2 * 60 * 1000);
    const startAt = new Date(
      Date.UTC(2026, 0, 1, recentDueAt.getUTCHours(), recentDueAt.getUTCMinutes(), recentDueAt.getUTCSeconds()),
    );
    const reminder = buildReminder({ startAt });
    const { prisma } = buildPrisma({ reminders: [reminder], events: [] });
    const service = new ReminderConsistencyService(prisma);

    const report = await service.checkConsistency(now);

    expect(report.discrepancies).toEqual([]);
    // Sanity: the occurrence IS in the predicted set (it's simply not old enough to flag).
    expect(report.predictedInWindow).toBeGreaterThan(0);
    expect(now.getTime() - recentDueAt.getTime()).toBeLessThan(CONSISTENCY_GRACE_MS);
  });

  it("respects COUNT/UNTIL -- an exhausted/inactive series predicts nothing beyond its end", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    // COUNT=1 anchored well before the window -- the series is exhausted long before `now`.
    const reminder = buildReminder({ rrule: "FREQ=DAILY;COUNT=1", startAt: new Date("2026-01-01T09:00:00.000Z") });
    const { prisma } = buildPrisma({ reminders: [reminder], events: [] });
    const service = new ReminderConsistencyService(prisma);

    const report = await service.checkConsistency(now);

    expect(report.predictedInWindow).toBe(0);
    expect(report.discrepancies).toEqual([]);
  });

  it("returns an empty report for no reminders / no events", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const { prisma, reminderFindMany, eventFindMany } = buildPrisma({ reminders: [], events: [] });
    const service = new ReminderConsistencyService(prisma);

    const report = await service.checkConsistency(now);

    expect(report).toEqual<ConsistencyReport>({
      from: new Date(now.getTime() - CONSISTENCY_WINDOW_MS),
      to: now,
      remindersScanned: 0,
      predictedInWindow: 0,
      materializedInWindow: 0,
      discrepancies: [],
    });
    expect(reminderFindMany).toHaveBeenCalledWith({
      select: { id: true, rrule: true, timezone: true, startAt: true },
    });
    expect(eventFindMany).toHaveBeenCalledWith({
      where: { dueAt: { gte: report.from, lte: now } },
      select: { id: true, reminderId: true, dueAt: true, status: true },
    });
  });

  it("logs ids/counts only -- never title/type/medNameAsEntered", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const reminder = buildReminder({ rrule: "FREQ=YEARLY", startAt: new Date("2020-01-15T09:00:00.000Z") });
    const orphanDueAt = new Date("2026-07-14T10:00:00.000Z");
    const { prisma } = buildPrisma({
      reminders: [reminder],
      events: [{ id: "event-orphan", reminderId: "rem-1", dueAt: orphanDueAt, status: "SENT" }],
    });
    const service = new ReminderConsistencyService(prisma);
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();

    await service.checkConsistency(now);

    const ALLOWED_KEYS = new Set([
      "event",
      "remindersScanned",
      "predictedInWindow",
      "materializedInWindow",
      "orphanCount",
      "missingCount",
      "kind",
      "reminderId",
      "dueAtEpochMs",
      "eventId",
    ]);
    for (const call of [...logSpy.mock.calls, ...warnSpy.mock.calls]) {
      const payload = call[0] as Record<string, unknown>;
      for (const key of Object.keys(payload)) {
        expect(ALLOWED_KEYS.has(key)).toBe(true);
      }
    }
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: "reminder_consistency_discrepancy", kind: "orphan_event" }),
    );

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
