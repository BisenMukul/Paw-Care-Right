import type { Queue } from "bullmq";

import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import type { ExpoPushClient, PushMessage, PushReceipt, PushTicket } from "./expo-push.client";
import { PUSH_RECEIPT_JOB_NAME, RECEIPT_CHECK_DELAY_MS, type PushReceiptJobData } from "./push-receipts.contract";
import { buildReminderPushBody, collapseKey, PushSenderService } from "./push-sender.service";
import type { PushJobData } from "./push.contract";

/**
 * Direct-construct unit tests (T057 plan "Tests to write"; extended by T058
 * "prefs respected in sender tests"): hand-built mock
 * Prisma/ExpoPushClient/RedisService/receipts-queue/push-queue, `new
 * PushSenderService(prisma, expoClient, redis, receiptsQueue, pushQueue)` --
 * mirrors `reminder-scheduler.service.spec.ts` / `redis.service.spec.ts`
 * mocking style. The Expo SDK is NEVER invoked for real -- only the mocked
 * `ExpoPushClient` port.
 */
describe("PushSenderService", () => {
  const EVENT_ID = "event-1";

  interface EventMembership {
    userId: string;
  }

  interface FakeEvent {
    id: string;
    status: string;
    dueAt: Date;
    reminder: {
      pet: {
        household: {
          memberships: EventMembership[];
        };
      };
    };
  }

  function buildEvent(
    overrides: Partial<{ id: string; status: string; dueAt: Date; memberships: EventMembership[] }> = {},
  ): FakeEvent {
    return {
      id: overrides.id ?? EVENT_ID,
      status: overrides.status ?? "SENT",
      dueAt: overrides.dueAt ?? new Date("2026-07-14T09:00:00.000Z"),
      reminder: {
        pet: {
          household: {
            memberships: overrides.memberships ?? [{ userId: "user-1" }],
          },
        },
      },
    };
  }

  interface GroupRow {
    id: string;
    reminder: { title: string; type: string };
  }

  interface DeviceRow {
    id: string;
    expoPushToken: string;
  }

  interface PrefsRow {
    disabledTypes: string[];
    quietStart: string | null;
    quietEnd: string | null;
    timezone: string | null;
  }

  interface GroupFindManyArgs {
    where: { reminder: { pet: { household: { memberships: { some: { userId: string } } } } } };
  }

  interface DeviceFindManyArgs {
    where: { userId: string };
  }

  /** Every fixture row defaults to an enabled type ("CUSTOM") unless a test overrides it (T058 plan). */
  function groupRow(id: string, title: string, type = "CUSTOM"): GroupRow {
    return { id, reminder: { title, type } };
  }

  function buildPrisma(opts: {
    event?: FakeEvent | null;
    groupByUser?: Record<string, GroupRow[]>;
    devicesByUser?: Record<string, DeviceRow[]>;
    prefsByUser?: Record<string, PrefsRow | null>;
  }) {
    const findUnique = jest.fn().mockResolvedValue(opts.event === undefined ? buildEvent() : opts.event);
    const findMany = jest.fn().mockImplementation((args: GroupFindManyArgs) => {
      const userId = args.where.reminder.pet.household.memberships.some.userId;
      return Promise.resolve(opts.groupByUser?.[userId] ?? []);
    });
    const deviceFindMany = jest.fn().mockImplementation((args: DeviceFindManyArgs) => {
      return Promise.resolve(opts.devicesByUser?.[args.where.userId] ?? []);
    });
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const prefsFindUnique = jest
      .fn()
      .mockImplementation((args: { where: { userId: string } }) =>
        Promise.resolve(opts.prefsByUser?.[args.where.userId] ?? null),
      );

    const prisma = {
      reminderEvent: { findUnique, findMany },
      device: { findMany: deviceFindMany, deleteMany },
      userNotificationPrefs: { findUnique: prefsFindUnique },
    } as unknown as PrismaService;

    return { prisma, findUnique, findMany, deviceFindMany, deleteMany, prefsFindUnique };
  }

  function buildExpoClient(
    overrides: {
      isValidToken?: jest.Mock<boolean, [string]>;
      sendChunk?: jest.Mock<Promise<PushTicket[]>, [PushMessage[]]>;
      getReceipts?: jest.Mock<Promise<Map<string, PushReceipt>>, [string[]]>;
    } = {},
  ) {
    const isValidToken = overrides.isValidToken ?? jest.fn().mockReturnValue(true);
    const sendChunk =
      overrides.sendChunk ??
      jest.fn((messages: PushMessage[]) => Promise.resolve(messages.map((m, i) => ({ status: "ok" as const, id: `ticket-${i}` }))));
    const getReceipts = overrides.getReceipts ?? jest.fn().mockResolvedValue(new Map());
    const client: ExpoPushClient = { isValidToken, sendChunk, getReceipts };
    return { client, isValidToken, sendChunk, getReceipts };
  }

  function buildRedis(overrides: { setNx?: jest.Mock; get?: jest.Mock } = {}) {
    const setNx = overrides.setNx ?? jest.fn().mockResolvedValue(true);
    const get = overrides.get ?? jest.fn().mockResolvedValue(null);
    const redis = { setNx, get } as unknown as RedisService;
    return { redis, setNx, get };
  }

  function buildReceiptsQueue(overrides: { add?: jest.Mock } = {}) {
    const add = overrides.add ?? jest.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue<PushReceiptJobData>;
    return { queue, add };
  }

  function buildPushQueue(overrides: { add?: jest.Mock } = {}) {
    const add = overrides.add ?? jest.fn().mockResolvedValue(undefined);
    const queue = { add } as unknown as Queue<PushJobData>;
    return { queue, add };
  }

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("batching", () => {
    it("chunks >100 device messages into 100/100/50 and preserves ticket→device correlation", async () => {
      const devices = Array.from({ length: 250 }, (_, i) => ({ id: `device-${i}`, expoPushToken: `token-${i}` }));
      const { prisma, deleteMany } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": devices },
      });
      const sendChunk = jest.fn((messages: PushMessage[]) =>
        Promise.resolve(
          messages.map((m): PushTicket =>
            m.to === "token-249" ? { status: "error", errorCode: "DeviceNotRegistered" } : { status: "ok", id: `ticket-${m.to}` },
          ),
        ),
      );
      const { client } = buildExpoClient({ sendChunk });
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).toHaveBeenCalledTimes(3);
      expect((sendChunk.mock.calls[0]?.[0] as PushMessage[]).length).toBe(100);
      expect((sendChunk.mock.calls[1]?.[0] as PushMessage[]).length).toBe(100);
      expect((sendChunk.mock.calls[2]?.[0] as PushMessage[]).length).toBe(50);

      expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["device-249"] } } });
    });
  });

  describe("collapse logic", () => {
    it("collapses 3 same-user same-minute events into ONE push with count 3", async () => {
      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: {
          "user-1": [groupRow("e1", "A"), groupRow("e2", "B"), groupRow("e3", "C")],
        },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
      });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis({ setNx: jest.fn().mockResolvedValue(true) });
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).toHaveBeenCalledTimes(1);
      const messages = sendChunk.mock.calls[0]?.[0] as PushMessage[];
      expect(messages).toHaveLength(1);
      expect(messages[0]?.body).toBe("3 care reminders due");
      expect(messages[0]?.data.count).toBe(3);
    });

    it("a losing event for an already-claimed (user,minute) sends nothing", async () => {
      const { prisma } = buildPrisma({ event: buildEvent() });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis({
        setNx: jest.fn().mockResolvedValue(false),
        get: jest.fn().mockResolvedValue("other-event"),
      });
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).not.toHaveBeenCalled();
    });

    it("the winning event's retry re-enters (setNx false but owner === self) and sends", async () => {
      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
      });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis({
        setNx: jest.fn().mockResolvedValue(false),
        get: jest.fn().mockResolvedValue(EVENT_ID),
      });
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).toHaveBeenCalledTimes(1);
    });

    it("single reminder renders 'Care reminder: {title}' with count 1", async () => {
      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Give heartworm chewable")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
      });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      const messages = sendChunk.mock.calls[0]?.[0] as PushMessage[];
      expect(messages[0]?.body).toBe("Care reminder: Give heartworm chewable");
    });

    it("different users in the same household each get their own claim + push", async () => {
      const { prisma } = buildPrisma({
        event: buildEvent({ memberships: [{ userId: "user-1" }, { userId: "user-2" }] }),
        groupByUser: {
          "user-1": [groupRow("event-1", "Feed")],
          "user-2": [groupRow("event-1", "Feed")],
        },
        devicesByUser: {
          "user-1": [{ id: "device-1", expoPushToken: "token-1" }],
          "user-2": [{ id: "device-2", expoPushToken: "token-2" }],
        },
      });
      const { client, sendChunk } = buildExpoClient();
      const setNx = jest.fn().mockResolvedValue(true);
      const { redis } = buildRedis({ setNx });
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).toHaveBeenCalledTimes(1);
      const messages = sendChunk.mock.calls[0]?.[0] as PushMessage[];
      expect(messages).toHaveLength(2);

      const keys = setNx.mock.calls.map((c) => c[0] as string);
      expect(keys.some((k) => k.includes("user-1"))).toBe(true);
      expect(keys.some((k) => k.includes("user-2"))).toBe(true);
      expect(new Set(keys).size).toBe(2);
    });

    it("collapse key embeds the minute epoch", async () => {
      const dueAt = new Date("2026-07-14T09:03:00.000Z");
      const minuteEpoch = Math.floor(dueAt.getTime() / 60_000);
      const { prisma } = buildPrisma({
        event: buildEvent({ dueAt }),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
      });
      const { client } = buildExpoClient();
      const setNx = jest.fn().mockResolvedValue(true);
      const { redis } = buildRedis({ setNx });
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(setNx.mock.calls[0]?.[0]).toBe(`pawcareright:push:collapse:user-1:${minuteEpoch}`);
    });
  });

  describe("pruning on tickets and receipts", () => {
    it("prunes the device when a TICKET is DeviceNotRegistered and collects no receipt for it", async () => {
      const { prisma, deleteMany } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
      });
      const sendChunk = jest.fn().mockResolvedValue([{ status: "error", errorCode: "DeviceNotRegistered" }]);
      const { client } = buildExpoClient({ sendChunk });
      const { redis } = buildRedis();
      const add = jest.fn().mockResolvedValue(undefined);
      const { queue } = buildReceiptsQueue({ add });
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["device-1"] } } });
      expect(add).not.toHaveBeenCalled();
    });

    it("checkReceipts prunes the device when a RECEIPT is DeviceNotRegistered", async () => {
      const { prisma, deleteMany } = buildPrisma({});
      const getReceipts = jest
        .fn()
        .mockResolvedValue(new Map([["ticket-1", { status: "error", errorCode: "DeviceNotRegistered" }]]));
      const { client } = buildExpoClient({ getReceipts });
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.checkReceipts([{ ticketId: "ticket-1", deviceId: "device-1" }]);

      expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["device-1"] } } });
    });

    it("checkReceipts does NOT prune on a non-DeviceNotRegistered receipt error", async () => {
      const { prisma, deleteMany } = buildPrisma({});
      const getReceipts = jest
        .fn()
        .mockResolvedValue(new Map([["ticket-1", { status: "error", errorCode: "MessageRateExceeded" }]]));
      const { client } = buildExpoClient({ getReceipts });
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.checkReceipts([{ ticketId: "ticket-1", deviceId: "device-1" }]);

      expect(deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("receipt flow + guards + errors", () => {
    it("enqueues a delayed receipt-check job for ok tickets", async () => {
      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
      });
      const sendChunk = jest.fn().mockResolvedValue([{ status: "ok", id: "ticket-1" }]);
      const { client } = buildExpoClient({ sendChunk });
      const { redis } = buildRedis();
      const add = jest.fn().mockResolvedValue(undefined);
      const { queue } = buildReceiptsQueue({ add });
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(add).toHaveBeenCalledWith(
        PUSH_RECEIPT_JOB_NAME,
        { tickets: [{ ticketId: "ticket-1", deviceId: "device-1" }] },
        expect.objectContaining({ jobId: `receipt:${EVENT_ID}`, delay: RECEIPT_CHECK_DELAY_MS }),
      );
    });

    it("no-ops when the event is missing or not SENT", async () => {
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();

      const { prisma: prismaMissing } = buildPrisma({ event: null });
      const serviceMissing = new PushSenderService(prismaMissing, client, redis, queue, pushQueue);
      await serviceMissing.sendForEvent(EVENT_ID);
      expect(sendChunk).not.toHaveBeenCalled();

      const { prisma: prismaDone } = buildPrisma({ event: buildEvent({ status: "DONE" }) });
      const serviceDone = new PushSenderService(prismaDone, client, redis, queue, pushQueue);
      await serviceDone.sendForEvent(EVENT_ID);
      expect(sendChunk).not.toHaveBeenCalled();
    });

    it("no-ops cleanly when the user has no devices", async () => {
      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": [] },
      });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await expect(service.sendForEvent(EVENT_ID)).resolves.toBeUndefined();
      expect(sendChunk).not.toHaveBeenCalled();
    });

    it("isolates a failing chunk and throws to trigger retry", async () => {
      const devices = Array.from({ length: 150 }, (_, i) => ({ id: `device-${i}`, expoPushToken: `token-${i}` }));
      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": devices },
      });
      const sendChunk = jest
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockImplementationOnce((messages: PushMessage[]) =>
          Promise.resolve(messages.map((m): PushTicket => ({ status: "ok", id: `ticket-${m.to}` }))),
        );
      const { client } = buildExpoClient({ sendChunk });
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await expect(service.sendForEvent(EVENT_ID)).rejects.toThrow("expo_send_transient_failure");
      expect(sendChunk).toHaveBeenCalledTimes(2);
    });
  });

  describe("notification prefs (T058)", () => {
    it("suppresses a push when the only due type is disabled -- no send, no prune", async () => {
      const { prisma, deviceFindMany, deleteMany } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Give heartworm chewable", "CUSTOM")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
        prefsByUser: { "user-1": { disabledTypes: ["CUSTOM"], quietStart: null, quietEnd: null, timezone: null } },
      });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue, add: pushAdd } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).not.toHaveBeenCalled();
      expect(deviceFindMany).not.toHaveBeenCalled();
      expect(deleteMany).not.toHaveBeenCalled();
      expect(pushAdd).not.toHaveBeenCalled();
    });

    it("still sends the enabled sibling when a mixed group has one disabled type, with adjusted count", async () => {
      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: {
          "user-1": [groupRow("e-custom", "Custom thing", "CUSTOM"), groupRow("e-vaccine", "Rabies booster", "VACCINE")],
        },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
        prefsByUser: { "user-1": { disabledTypes: ["CUSTOM"], quietStart: null, quietEnd: null, timezone: null } },
      });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).toHaveBeenCalledTimes(1);
      const messages = sendChunk.mock.calls[0]?.[0] as PushMessage[];
      expect(messages).toHaveLength(1);
      expect(messages[0]?.data.count).toBe(1);
      expect(messages[0]?.body).toBe("Care reminder: Rabies booster");
    });

    it("defers a push inside the quiet window to window-end and does not send", async () => {
      const fixedNow = new Date("2026-06-15T03:00:00.000Z"); // 2026-06-14 23:00 EDT
      jest.useFakeTimers().setSystemTime(fixedNow);

      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
        prefsByUser: {
          "user-1": { disabledTypes: [], quietStart: "22:00", quietEnd: "07:00", timezone: "America/New_York" },
        },
      });
      const { client, sendChunk } = buildExpoClient();
      const setNx = jest.fn().mockResolvedValue(true);
      const { redis } = buildRedis({ setNx });
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue, add: pushAdd } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).not.toHaveBeenCalled();
      expect(setNx).not.toHaveBeenCalled();
      expect(pushAdd).toHaveBeenCalledTimes(1);
      const [, payload, options] = pushAdd.mock.calls[0] as [string, PushJobData, { jobId: string; delay: number }];
      expect(payload).toEqual({ reminderEventId: EVENT_ID, userId: "user-1" });
      expect(options.jobId.startsWith(`${EVENT_ID}:defer:user-1:`)).toBe(true);
      // window-end = 2026-06-15 07:00 EDT = 2026-06-15T11:00:00.000Z
      const expectedDelay = new Date("2026-06-15T11:00:00.000Z").getTime() - fixedNow.getTime();
      expect(options.delay).toBe(expectedDelay);
    });

    it("sends normally when outside the quiet window", async () => {
      const fixedNow = new Date("2026-06-15T16:00:00.000Z"); // 2026-06-15 12:00 EDT -- outside 22:00-07:00
      jest.useFakeTimers().setSystemTime(fixedNow);

      const { prisma } = buildPrisma({
        event: buildEvent(),
        groupByUser: { "user-1": [groupRow("event-1", "Feed")] },
        devicesByUser: { "user-1": [{ id: "device-1", expoPushToken: "token-1" }] },
        prefsByUser: {
          "user-1": { disabledTypes: [], quietStart: "22:00", quietEnd: "07:00", timezone: "America/New_York" },
        },
      });
      const { client, sendChunk } = buildExpoClient();
      const { redis } = buildRedis();
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue, add: pushAdd } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      await service.sendForEvent(EVENT_ID);

      expect(sendChunk).toHaveBeenCalledTimes(1);
      expect(pushAdd).not.toHaveBeenCalled();
    });

    it("[checker regression] multi-member household: a quiet-houred member's deferred re-run does NOT double-push the non-quiet co-member", async () => {
      // t=23:00 EDT: user-A is inside its 22:00-07:00 quiet window; user-B has no prefs row.
      const atDeferTime = new Date("2026-06-15T03:00:00.000Z");
      jest.useFakeTimers().setSystemTime(atDeferTime);

      const { prisma, deviceFindMany } = buildPrisma({
        event: buildEvent({ memberships: [{ userId: "user-A" }, { userId: "user-B" }] }),
        groupByUser: {
          "user-A": [groupRow("event-1", "Feed A")],
          "user-B": [groupRow("event-1", "Feed B")],
        },
        devicesByUser: {
          "user-A": [{ id: "device-a", expoPushToken: "token-a" }],
          "user-B": [{ id: "device-b", expoPushToken: "token-b" }],
        },
        prefsByUser: {
          "user-A": { disabledTypes: [], quietStart: "22:00", quietEnd: "07:00", timezone: "America/New_York" },
          // user-B: no row -> defaults -> never deferred.
        },
      });
      const { client, sendChunk } = buildExpoClient();
      const setNx = jest.fn().mockResolvedValue(true);
      const { redis } = buildRedis({ setNx });
      const { queue } = buildReceiptsQueue();
      const { queue: pushQueue, add: pushAdd } = buildPushQueue();
      const service = new PushSenderService(prisma, client, redis, queue, pushQueue);

      // Original scheduler run (no targetUserId, the T056 producer's job shape):
      // user-A defers, user-B is sent immediately.
      await service.sendForEvent(EVENT_ID);

      expect(pushAdd).toHaveBeenCalledTimes(1);
      const [, deferredPayload] = pushAdd.mock.calls[0] as [string, PushJobData];
      expect(deferredPayload).toEqual({ reminderEventId: EVENT_ID, userId: "user-A" });
      expect(sendChunk).toHaveBeenCalledTimes(1);
      const firstRunMessages = sendChunk.mock.calls[0]?.[0] as PushMessage[];
      expect(firstRunMessages.map((m) => m.to)).toEqual(["token-b"]);

      const deviceFetchesBeforeReplay = deviceFindMany.mock.calls.length;

      // Window-end deferred re-run: `PushProcessor` invokes with ONLY the
      // deferred userId (T058 checker fix) -- exactly at the window end
      // (end-exclusive: user-A now delivers instead of re-deferring).
      jest.setSystemTime(new Date("2026-06-15T11:00:00.000Z"));
      await service.sendForEvent(EVENT_ID, "user-A");

      // user-A is sent exactly once, in this second run.
      expect(sendChunk).toHaveBeenCalledTimes(2);
      const secondRunMessages = sendChunk.mock.calls[1]?.[0] as PushMessage[];
      expect(secondRunMessages.map((m) => m.to)).toEqual(["token-a"]);

      // user-B must NOT be reprocessed at all on the targeted re-run: no new
      // device fetch, no second send, no duplicate collapse claim.
      expect(deviceFindMany.mock.calls.length).toBe(deviceFetchesBeforeReplay + 1);
      const deviceFetchesDuringReplay = deviceFindMany.mock.calls.slice(deviceFetchesBeforeReplay);
      expect(
        deviceFetchesDuringReplay.some((call) => (call[0] as { where: { userId: string } }).where.userId === "user-B"),
      ).toBe(false);

      // user-B's total sends across BOTH runs == 1 (the checker's exact assertion).
      const allSentTokens = sendChunk.mock.calls.flatMap((call) => (call[0] as PushMessage[]).map((m) => m.to));
      expect(allSentTokens.filter((to) => to === "token-b")).toHaveLength(1);
      expect(allSentTokens.filter((to) => to === "token-a")).toHaveLength(1);

      // Two distinct collapse claims total (one per user), never a repeat for the same user.
      expect(setNx).toHaveBeenCalledTimes(2);
      const claimKeys = setNx.mock.calls.map((c) => c[0] as string);
      expect(new Set(claimKeys).size).toBe(2);
    });
  });

  describe("pure helpers", () => {
    it("buildReminderPushBody renders count>=2 as '{n} care reminders due'", () => {
      expect(buildReminderPushBody({ count: 2, singleTitle: "x" })).toBe("2 care reminders due");
      expect(buildReminderPushBody({ count: 5, singleTitle: "x" })).toBe("5 care reminders due");
    });

    it("buildReminderPushBody renders count 1 as 'Care reminder: {title}'", () => {
      expect(buildReminderPushBody({ count: 1, singleTitle: "Feed the cat" })).toBe("Care reminder: Feed the cat");
    });

    it("collapseKey embeds userId and minuteEpoch", () => {
      expect(collapseKey("user-1", 123)).toBe("pawcareright:push:collapse:user-1:123");
    });
  });
});
