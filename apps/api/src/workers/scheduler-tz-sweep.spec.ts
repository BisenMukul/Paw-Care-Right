import type { Queue } from "bullmq";

import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import type { ExpoPushClient, PushMessage, PushTicket } from "./expo-push.client";
import type { PushReceiptJobData } from "./push-receipts.contract";
import { PushSenderService } from "./push-sender.service";
import type { PushJobData } from "./push.contract";
import { BACKFILL_WINDOW_MS, ReminderSchedulerService } from "./reminder-scheduler.service";

/**
 * `ReminderSchedulerService` clock-skew / tz-change / e2e sweep (T062 plan
 * carry-forwards #2, #4, #6). See `../reminders/timezone-matrix.spec.ts`
 * §matrix for this file's place in the master tz test matrix. Mirrors
 * `reminder-scheduler.service.spec.ts`'s direct-construct fake-Prisma
 * mocking style -- a fresh, minimal copy of just the fixtures this file
 * needs (no cross-file test-helper import).
 */
describe("ReminderSchedulerService tz/clock-skew sweep", () => {
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

  function buildPrisma(opts: {
    reminders?: ReminderRow[];
    create?: jest.Mock;
    updateMany?: jest.Mock;
  }) {
    const findMany = jest.fn().mockResolvedValue(opts.reminders ?? [buildReminder()]);
    let nextEventSeq = 0;
    const create =
      opts.create ?? jest.fn().mockImplementation(() => Promise.resolve({ id: `event-${(nextEventSeq += 1)}` }));
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

  describe("clock-skew jitter (§CLOCK-SKEW)", () => {
    it("tick fires when now is a few ms past the exact dueAt boundary and advances by exactly one day, not the skew delta", async () => {
      const dueAt = new Date("2026-07-14T09:00:00.000Z");
      const now = new Date(dueAt.getTime() + 750); // the tick runs 750ms late (clock-skew jitter)
      const reminder = buildReminder({ nextFireAt: dueAt });
      const { prisma, create, updateMany } = buildPrisma({ reminders: [reminder] });
      const { pushQueue } = buildPushQueue();
      const service = new ReminderSchedulerService(prisma, pushQueue);

      await service.tick(now);

      // The materialized event's `dueAt` is the SCHEDULED instant, not the skewed `now`.
      expect(create).toHaveBeenCalledWith({
        data: { reminderId: "rem-1", dueAt, status: "SENT", sentAt: now },
      });
      // The advance target is anchored to `dueAt` (+1ms) -- exactly one day
      // later -- never `now` (+1ms), which would leak the 750ms skew forward.
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: "rem-1", nextFireAt: dueAt },
        data: { nextFireAt: new Date("2026-07-15T09:00:00.000Z") },
      });
    });

    it("a ±1ms clock-skew jitter around the same dueAt boundary produces the SAME advance target", async () => {
      const dueAt = new Date("2026-07-14T09:00:00.000Z");
      const nowSlightlyLate = new Date(dueAt.getTime() + 1);
      const nowMoreLate = new Date(dueAt.getTime() + 500);

      const run = async (now: Date) => {
        const reminder = buildReminder({ nextFireAt: dueAt });
        const { prisma, updateMany } = buildPrisma({ reminders: [reminder] });
        const { pushQueue } = buildPushQueue();
        const service = new ReminderSchedulerService(prisma, pushQueue);
        await service.tick(now);
        return (updateMany.mock.calls[0]?.[0] as { data: { nextFireAt: Date } }).data.nextFireAt;
      };

      const advanceA = await run(nowSlightlyLate);
      const advanceB = await run(nowMoreLate);

      expect(advanceA).toEqual(new Date("2026-07-15T09:00:00.000Z"));
      expect(advanceB).toEqual(new Date("2026-07-15T09:00:00.000Z"));
      expect(advanceA.getTime()).toBe(advanceB.getTime());
    });
  });

  describe("tz-change advance (§TZ-CHANGE)", () => {
    it("tick advances to the next-tz wall clock after a reminder row's timezone changed between ticks", async () => {
      const startAt = new Date("2026-01-01T03:30:00.000Z"); // 09:00 IST / 22:30 EST (prior day) in America/New_York

      // Tick 1: due now, timezone Asia/Kolkata.
      const reminderKolkata = buildReminder({ timezone: "Asia/Kolkata", startAt, nextFireAt: startAt });
      const now1 = startAt;
      const { prisma: prisma1, updateMany: updateMany1 } = buildPrisma({ reminders: [reminderKolkata] });
      const { pushQueue: pushQueue1 } = buildPushQueue();
      const service1 = new ReminderSchedulerService(prisma1, pushQueue1);

      await service1.tick(now1);

      expect(updateMany1).toHaveBeenCalledWith({
        where: { id: "rem-1", nextFireAt: startAt },
        data: { nextFireAt: new Date("2026-01-02T03:30:00.000Z") }, // 09:00 IST next day
      });

      // Tick 2: the SAME reminder (same startAt, per RemindersService.update
      // semantics when only `timezone` is patched) after its timezone row
      // was changed to America/New_York -- `nextFireAt` carries over as
      // whatever tick 1 advanced it to.
      const nextFireAtAfterTzChange = new Date("2026-01-02T03:30:00.000Z");
      const reminderNy = buildReminder({
        timezone: "America/New_York",
        startAt,
        nextFireAt: nextFireAtAfterTzChange,
      });
      const now2 = nextFireAtAfterTzChange;
      const { prisma: prisma2, updateMany: updateMany2 } = buildPrisma({ reminders: [reminderNy] });
      const { pushQueue: pushQueue2 } = buildPushQueue();
      const service2 = new ReminderSchedulerService(prisma2, pushQueue2);

      await service2.tick(now2);

      // Independently-verified via the raw Intl script (see the executor's
      // final report): startAt reads as 2025-12-31 22:30 EST in
      // America/New_York; the next DAILY occurrence strictly after
      // 2026-01-02T03:30:00.001Z at that wall-clock time is
      // 2026-01-03T03:30:00.000Z (2026-01-02 22:30 EST).
      expect(updateMany2).toHaveBeenCalledWith({
        where: { id: "rem-1", nextFireAt: nextFireAtAfterTzChange },
        data: { nextFireAt: new Date("2026-01-03T03:30:00.000Z") },
      });
    });
  });

  describe("single-boot backfill exact 24h boundary (§INCLUSIVE-BOUNDARY)", () => {
    it("a missed occurrence exactly BACKFILL_WINDOW_MS old materializes once at the boundary and advances strictly past now, with no push", async () => {
      const now = new Date("2026-07-14T12:00:00.000Z");
      const nextFireAt = new Date(now.getTime() - BACKFILL_WINDOW_MS); // exactly 24h old
      // FREQ=DAILY;INTERVAL=2 (every 2 days) anchored AT nextFireAt itself:
      // within the exact-24h window [nextFireAt, now], only `nextFireAt`
      // itself is on the pattern -- the next occurrence is 48h later (24h
      // PAST `now`), so this is not confounded by the "both window
      // endpoints are occurrences" case a plain DAILY (24h) cadence would
      // hit here (see occurrences-between.spec.ts's own inclusive-boundary
      // test, which uses DAILY over a 2-day window instead).
      const reminder = buildReminder({ rrule: "FREQ=DAILY;INTERVAL=2", startAt: nextFireAt, nextFireAt });
      const { prisma, create, updateMany } = buildPrisma({ reminders: [reminder] });
      const { pushQueue, add } = buildPushQueue();
      const service = new ReminderSchedulerService(prisma, pushQueue);

      await service.backfill(now);

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        data: { reminderId: "rem-1", dueAt: nextFireAt, status: "MISSED" },
      });
      expect(add).not.toHaveBeenCalled();

      const updateArgs = updateMany.mock.calls[0]?.[0] as { data: { nextFireAt: Date } };
      expect(updateArgs.data.nextFireAt).toEqual(new Date(nextFireAt.getTime() + 48 * 60 * 60 * 1000));
      expect(updateArgs.data.nextFireAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe("snooze -> refireSnoozed -> push e2e (§consistency chain, carry-forward #2)", () => {
    interface SharedEventRow {
      id: string;
      reminderId: string;
      status: string;
      dueAt: Date;
      snoozedUntil: Date | null;
    }

    interface ReminderEventFindManyArgs {
      where?: { status?: string; snoozedUntil?: unknown };
      select?: { id?: boolean };
    }

    interface ReminderEventUpdateManyArgs {
      where: { id: string; status: string };
      data: { status: string; sentAt?: Date; snoozedUntil: null };
    }

    it("snooze -> refireSnoozed flips SENT and PushSenderService.sendForEvent then actually sends", async () => {
      const dueAt = new Date("2026-07-14T09:00:00.000Z");
      const eventRow: SharedEventRow = {
        id: "event-1",
        reminderId: "rem-1",
        status: "SNOOZED",
        dueAt,
        snoozedUntil: new Date("2026-07-14T09:03:00.000Z"),
      };

      const reminderEventFindMany = jest.fn().mockImplementation((args: ReminderEventFindManyArgs) => {
        if (args.select?.id === true) {
          // ReminderSchedulerService.refireSnoozed's snoozed-scan query.
          return Promise.resolve(eventRow.status === "SNOOZED" ? [{ id: eventRow.id }] : []);
        }
        // PushSenderService.sendForEvent's same-minute collapse-group query.
        return Promise.resolve(
          eventRow.status === "SENT"
            ? [{ id: eventRow.id, reminder: { title: "Give heartworm chewable", type: "CUSTOM" } }]
            : [],
        );
      });
      const reminderEventUpdateMany = jest.fn().mockImplementation((args: ReminderEventUpdateManyArgs) => {
        if (eventRow.status !== args.where.status || eventRow.id !== args.where.id) {
          return Promise.resolve({ count: 0 });
        }
        eventRow.status = args.data.status;
        eventRow.snoozedUntil = args.data.snoozedUntil;
        return Promise.resolve({ count: 1 });
      });
      const reminderEventFindUnique = jest.fn().mockImplementation(() =>
        Promise.resolve({
          id: eventRow.id,
          status: eventRow.status,
          dueAt: eventRow.dueAt,
          reminder: { pet: { household: { memberships: [{ userId: "user-1" }] } } },
        }),
      );
      const deviceFindMany = jest.fn().mockResolvedValue([{ id: "device-1", expoPushToken: "token-1" }]);
      const prefsFindUnique = jest.fn().mockResolvedValue(null);
      const deleteMany = jest.fn().mockResolvedValue({ count: 0 });

      const sharedPrisma = {
        reminderEvent: {
          findMany: reminderEventFindMany,
          updateMany: reminderEventUpdateMany,
          findUnique: reminderEventFindUnique,
        },
        device: { findMany: deviceFindMany, deleteMany },
        userNotificationPrefs: { findUnique: prefsFindUnique },
      } as unknown as PrismaService;

      const now = new Date("2026-07-14T09:05:00.000Z"); // past snoozedUntil
      const { pushQueue: schedulerPushQueue, add: schedulerPushAdd } = buildPushQueue();
      const scheduler = new ReminderSchedulerService(sharedPrisma, schedulerPushQueue);

      await scheduler.refireSnoozed(now);

      expect(eventRow.status).toBe("SENT");
      expect(schedulerPushAdd).toHaveBeenCalledTimes(1);
      expect(schedulerPushAdd).toHaveBeenCalledWith(
        "reminder-push",
        { reminderEventId: "event-1" },
        expect.objectContaining({ jobId: `event-1:snooze:${Math.floor(now.getTime() / 60_000)}` }),
      );

      // Feed the now-SENT event to PushSenderService.sendForEvent -- the
      // agenda-vs-fired chain (snooze -> refire -> push) has no gap.
      const sendChunk = jest.fn((messages: PushMessage[]) =>
        Promise.resolve(messages.map((): PushTicket => ({ status: "ok", id: "ticket-1" }))),
      );
      const expoClient: ExpoPushClient = {
        isValidToken: jest.fn().mockReturnValue(true),
        sendChunk,
        getReceipts: jest.fn().mockResolvedValue(new Map()),
      };
      const redis = {
        setNx: jest.fn().mockResolvedValue(true),
        get: jest.fn().mockResolvedValue(null),
      } as unknown as RedisService;
      const receiptsQueue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as Queue<PushReceiptJobData>;
      const { pushQueue: senderPushQueue } = buildPushQueue();
      const pushSender = new PushSenderService(sharedPrisma, expoClient, redis, receiptsQueue, senderPushQueue);

      await pushSender.sendForEvent(eventRow.id);

      expect(sendChunk).toHaveBeenCalledTimes(1);
      const messages = sendChunk.mock.calls[0]?.[0] as PushMessage[];
      expect(messages).toHaveLength(1);
      expect(messages[0]?.to).toBe("token-1");
    });
  });
});
