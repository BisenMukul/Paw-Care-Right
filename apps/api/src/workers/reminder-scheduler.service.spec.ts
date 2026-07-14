import { Prisma } from "@prisma/client";
import type { Queue } from "bullmq";

import type { PrismaService } from "../prisma/prisma.service";
import type { PushJobData } from "./push.contract";
import { BACKFILL_WINDOW_MS, isUniqueConstraintViolation, ReminderSchedulerService } from "./reminder-scheduler.service";

/**
 * Direct-construct fake-clock tests (T056 plan "Tests to write"): hand-built
 * mock Prisma + mock push queue, `new ReminderSchedulerService(prisma,
 * pushQueue)`, `tick`/`backfill` called with a fixed `now` -- mirrors
 * `check-runner.processor.spec.ts`. `parseRRule`/`computeNextFireAt`/
 * `occurrencesBetween` all run for REAL; only Prisma/BullMQ I/O is mocked.
 */
describe("ReminderSchedulerService", () => {
  interface ReminderRow {
    id: string;
    rrule: string;
    timezone: string;
    startAt: Date;
    nextFireAt: Date;
  }

  function buildReminder(overrides: Partial<ReminderRow> = {}): ReminderRow {
    return {
      id: overrides.id ?? "rem-1",
      rrule: overrides.rrule ?? "FREQ=DAILY",
      timezone: overrides.timezone ?? "UTC",
      startAt: overrides.startAt ?? new Date("2026-01-01T09:00:00.000Z"),
      nextFireAt: overrides.nextFireAt ?? new Date("2026-07-14T09:00:00.000Z"),
    };
  }

  function p2002(): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
  }

  function buildPrisma(opts: {
    reminders?: ReminderRow[];
    create?: jest.Mock;
    updateMany?: jest.Mock;
  }) {
    const findMany = jest.fn().mockResolvedValue(opts.reminders ?? [buildReminder()]);
    let nextEventSeq = 0;
    const create =
      opts.create ??
      jest.fn().mockImplementation(() => Promise.resolve({ id: `event-${(nextEventSeq += 1)}` }));
    const updateMany = opts.updateMany ?? jest.fn().mockResolvedValue({ count: 1 });

    const prisma = {
      reminder: { findMany, updateMany },
      reminderEvent: { create },
    } as unknown as PrismaService;

    return { prisma, findMany, create, updateMany };
  }

  function buildPushQueue(overrides: { add?: jest.Mock } = {}) {
    const add = overrides.add ?? jest.fn().mockResolvedValue(undefined);
    return { pushQueue: { add } as unknown as Queue<PushJobData>, add };
  }

  describe("isUniqueConstraintViolation", () => {
    it("is true only for a P2002 PrismaClientKnownRequestError", () => {
      expect(isUniqueConstraintViolation(p2002())).toBe(true);
      expect(isUniqueConstraintViolation(new Error("boom"))).toBe(false);
    });
  });

  it("fires a due reminder within the tick: creates a SENT event, enqueues a push, advances nextFireAt", async () => {
    const now = new Date("2026-07-14T09:00:00.000Z");
    const reminder = buildReminder({ nextFireAt: now });
    const { prisma, create, updateMany } = buildPrisma({ reminders: [reminder] });
    const { pushQueue, add } = buildPushQueue();
    const service = new ReminderSchedulerService(prisma, pushQueue);

    await service.tick(now);

    expect(create).toHaveBeenCalledWith({
      data: { reminderId: "rem-1", dueAt: now, status: "SENT", sentAt: now },
    });

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      "reminder-push",
      { reminderEventId: "event-1" },
      expect.objectContaining({ jobId: "event-1", removeOnComplete: true, removeOnFail: false }),
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "rem-1", nextFireAt: now },
      data: { nextFireAt: new Date("2026-07-15T09:00:00.000Z") },
    });
  });

  it("advances nextFireAt across a Europe/Paris spring-forward, holding 09:00 local", async () => {
    const startAt = new Date("2026-01-01T08:00:00.000Z"); // 09:00 CET
    const dueAt = new Date("2026-03-28T08:00:00.000Z"); // 09:00 CET (pre-DST)
    const now = new Date("2026-03-28T08:00:30.000Z"); // fired 30s late in the same tick
    const reminder = buildReminder({ timezone: "Europe/Paris", startAt, nextFireAt: dueAt });
    const { prisma, updateMany } = buildPrisma({ reminders: [reminder] });
    const { pushQueue } = buildPushQueue();
    const service = new ReminderSchedulerService(prisma, pushQueue);

    await service.tick(now);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "rem-1", nextFireAt: dueAt },
      data: { nextFireAt: new Date("2026-03-29T07:00:00.000Z") }, // 09:00 CEST
    });
  });

  it("backfill marks a <24h missed occurrence MISSED without enqueuing a push", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const nextFireAt = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2h behind
    // Anchor `startAt` to the same wall-clock time-of-day as `nextFireAt` so
    // the DAILY cadence actually lands on `nextFireAt` (not the fixture's
    // unrelated default 09:00 anchor).
    const startAt = new Date(
      Date.UTC(2026, 0, 1, nextFireAt.getUTCHours(), nextFireAt.getUTCMinutes(), nextFireAt.getUTCSeconds()),
    );
    const reminder = buildReminder({ startAt, nextFireAt });
    const { prisma, create, updateMany } = buildPrisma({ reminders: [reminder] });
    const { pushQueue, add } = buildPushQueue();
    const service = new ReminderSchedulerService(prisma, pushQueue);

    await service.backfill(now);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { reminderId: "rem-1", dueAt: nextFireAt, status: "MISSED" },
    });
    expect(add).not.toHaveBeenCalled();

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "rem-1" },
      data: { nextFireAt: expect.any(Date) as Date },
    });
    const updateArgs = updateMany.mock.calls[0]?.[0] as { data: { nextFireAt: Date } };
    expect(updateArgs.data.nextFireAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("backfill skips occurrences older than 24h and does not flood pushes", async () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    const nextFireAt = new Date(now.getTime() - 50 * 60 * 60 * 1000); // 50h behind (offset from the 24h boundary)
    // Same anchoring rationale as the previous test.
    const startAt = new Date(
      Date.UTC(2026, 0, 1, nextFireAt.getUTCHours(), nextFireAt.getUTCMinutes(), nextFireAt.getUTCSeconds()),
    );
    const reminder = buildReminder({ startAt, nextFireAt });
    const { prisma, create, updateMany } = buildPrisma({ reminders: [reminder] });
    const { pushQueue, add } = buildPushQueue();
    const service = new ReminderSchedulerService(prisma, pushQueue);

    await service.backfill(now);

    // Daily cadence, 24h window -> exactly one missed occurrence, never ~48h worth.
    expect(create).toHaveBeenCalledTimes(1);
    const createArgs = create.mock.calls[0]?.[0] as { data: { dueAt: Date } };
    expect(createArgs.data.dueAt.getTime()).toBeGreaterThanOrEqual(now.getTime() - BACKFILL_WINDOW_MS);
    expect(add).not.toHaveBeenCalled();

    const updateArgs = updateMany.mock.calls[0]?.[0] as { data: { nextFireAt: Date } };
    expect(updateArgs.data.nextFireAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("is idempotent on a double-tick in the same minute: one event, one push, one advance path", async () => {
    const now = new Date("2026-07-14T09:00:00.000Z");
    const reminder = buildReminder({ nextFireAt: now });
    const create = jest
      .fn()
      .mockResolvedValueOnce({ id: "event-1" })
      .mockRejectedValueOnce(p2002());
    const { prisma, updateMany } = buildPrisma({ reminders: [reminder], create });
    const { pushQueue, add } = buildPushQueue();
    const service = new ReminderSchedulerService(prisma, pushQueue);

    await service.tick(now);
    await service.tick(now);

    expect(create).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      "reminder-push",
      { reminderEventId: "event-1" },
      expect.objectContaining({ jobId: "event-1" }),
    );
    // Advance is attempted (guarded) both times -- on a real DB the second
    // is a 0-row no-op because the first already moved `nextFireAt`.
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it("deactivates a reminder whose series is exhausted instead of leaving it due", async () => {
    const now = new Date("2026-07-14T09:00:00.000Z");
    const reminder = buildReminder({
      rrule: "FREQ=DAILY;COUNT=1",
      startAt: now,
      nextFireAt: now,
    });
    const { prisma, updateMany } = buildPrisma({ reminders: [reminder] });
    const { pushQueue } = buildPushQueue();
    const service = new ReminderSchedulerService(prisma, pushQueue);

    await service.tick(now);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "rem-1", nextFireAt: now },
      data: { active: false },
    });
  });

  it("isolates a failing reminder so other due reminders still fire", async () => {
    const now = new Date("2026-07-14T09:00:00.000Z");
    const reminderA = buildReminder({ id: "rem-a", nextFireAt: now });
    const reminderB = buildReminder({ id: "rem-b", nextFireAt: now });
    const create = jest.fn().mockImplementation((args: { data: { reminderId: string } }) => {
      if (args.data.reminderId === "rem-a") {
        return Promise.reject(new Error("infra down"));
      }
      return Promise.resolve({ id: "event-b" });
    });
    const { prisma, updateMany } = buildPrisma({ reminders: [reminderA, reminderB], create });
    const { pushQueue, add } = buildPushQueue();
    const service = new ReminderSchedulerService(prisma, pushQueue);

    await expect(service.tick(now)).resolves.toBeUndefined();

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      "reminder-push",
      { reminderEventId: "event-b" },
      expect.objectContaining({ jobId: "event-b" }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "rem-b", nextFireAt: now },
      data: { nextFireAt: new Date("2026-07-15T09:00:00.000Z") },
    });
  });
});
