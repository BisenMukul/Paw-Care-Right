import type { PrismaService } from "../prisma/prisma.service";
import { NotificationPrefsService } from "./notification-prefs.service";

describe("NotificationPrefsService", () => {
  const userId = "user-1";

  function buildPrisma(overrides: { findUnique?: jest.Mock; upsert?: jest.Mock } = {}) {
    const findUnique = overrides.findUnique ?? jest.fn().mockResolvedValue(null);
    const upsert = overrides.upsert ?? jest.fn();
    const prisma = { userNotificationPrefs: { findUnique, upsert } } as unknown as PrismaService;
    return { prisma, findUnique, upsert };
  }

  describe("get", () => {
    it("returns defaults when no row exists", async () => {
      const { prisma } = buildPrisma({ findUnique: jest.fn().mockResolvedValue(null) });
      const service = new NotificationPrefsService(prisma);

      const result = await service.get(userId);

      expect(result).toEqual({ disabledTypes: [], quietHours: null });
    });

    it("maps an existing row WITHOUT a quiet window", async () => {
      const { prisma } = buildPrisma({
        findUnique: jest.fn().mockResolvedValue({
          disabledTypes: ["CUSTOM"],
          quietStart: null,
          quietEnd: null,
          timezone: null,
        }),
      });
      const service = new NotificationPrefsService(prisma);

      const result = await service.get(userId);

      expect(result).toEqual({ disabledTypes: ["CUSTOM"], quietHours: null });
    });

    it("maps an existing row WITH a quiet window", async () => {
      const { prisma } = buildPrisma({
        findUnique: jest.fn().mockResolvedValue({
          disabledTypes: [],
          quietStart: "22:00",
          quietEnd: "07:00",
          timezone: "Europe/Paris",
        }),
      });
      const service = new NotificationPrefsService(prisma);

      const result = await service.get(userId);

      expect(result).toEqual({
        disabledTypes: [],
        quietHours: { start: "22:00", end: "07:00", timezone: "Europe/Paris" },
      });
    });
  });

  describe("update", () => {
    it("upserts the create-path (row didn't exist) and returns mapped prefs", async () => {
      const upsert = jest.fn().mockResolvedValue({
        disabledTypes: ["VACCINE"],
        quietStart: "22:00",
        quietEnd: "07:00",
        timezone: "America/New_York",
      });
      const { prisma } = buildPrisma({ upsert });
      const service = new NotificationPrefsService(prisma);

      const result = await service.update(userId, {
        disabledTypes: ["VACCINE"],
        quietHours: { start: "22:00", end: "07:00", timezone: "America/New_York" },
      });

      expect(upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          disabledTypes: ["VACCINE"],
          quietStart: "22:00",
          quietEnd: "07:00",
          timezone: "America/New_York",
        },
        update: {
          disabledTypes: ["VACCINE"],
          quietStart: "22:00",
          quietEnd: "07:00",
          timezone: "America/New_York",
        },
      });
      expect(result).toEqual({
        disabledTypes: ["VACCINE"],
        quietHours: { start: "22:00", end: "07:00", timezone: "America/New_York" },
      });
    });

    it("upserts the update-path (row already existed) with the same payload shape", async () => {
      const upsert = jest.fn().mockResolvedValue({
        disabledTypes: [],
        quietStart: null,
        quietEnd: null,
        timezone: null,
      });
      const { prisma } = buildPrisma({ upsert });
      const service = new NotificationPrefsService(prisma);

      await service.update(userId, { disabledTypes: [], quietHours: null });

      expect(upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId, disabledTypes: [], quietStart: null, quietEnd: null, timezone: null },
        update: { disabledTypes: [], quietStart: null, quietEnd: null, timezone: null },
      });
    });

    it("quietHours: null nulls all three quiet-window columns", async () => {
      const upsert = jest.fn().mockResolvedValue({
        disabledTypes: ["CUSTOM"],
        quietStart: null,
        quietEnd: null,
        timezone: null,
      });
      const { prisma } = buildPrisma({ upsert });
      const service = new NotificationPrefsService(prisma);

      const result = await service.update(userId, { disabledTypes: ["CUSTOM"], quietHours: null });

      expect(upsert.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          create: expect.objectContaining({ quietStart: null, quietEnd: null, timezone: null }),
          update: expect.objectContaining({ quietStart: null, quietEnd: null, timezone: null }),
        }),
      );
      expect(result.quietHours).toBeNull();
    });
  });
});
