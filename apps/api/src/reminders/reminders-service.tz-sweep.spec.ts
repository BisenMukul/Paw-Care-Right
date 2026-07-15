import { BadRequestException } from "@nestjs/common";

import type { PetResponse } from "../pets/pets.service";
import type { PetsService } from "../pets/pets.service";
import type { PrismaService } from "../prisma/prisma.service";
import { RemindersService } from "./reminders.service";

/**
 * `RemindersService` tz-change sweep (T062 plan carry-forward #5). See
 * `timezone-matrix.spec.ts` §matrix ("RemindersService.agenda" /
 * "RemindersService.assertOccurrence" rows) for this file's place in the
 * master tz test matrix. Mirrors `reminders.service.spec.ts`'s mocking
 * style (hand-built Prisma, `buildPetsService`) -- a fresh, minimal copy of
 * just the fixtures this file needs (no cross-file test-helper import).
 */
const HOUSEHOLD_ID = "household-1";
const REMINDER_ID = "reminder-1";
const PET_ID = "pet-1";

function buildPet(overrides: Partial<PetResponse> = {}): PetResponse {
  return {
    id: PET_ID,
    householdId: HOUSEHOLD_ID,
    species: "DOG",
    sex: "UNKNOWN",
    name: "Fido",
    neutered: false,
    breedSlug: null,
    birthDate: null,
    ageEstimateMonths: null,
    weightGrams: null,
    photoKey: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildPetsService(): PetsService {
  return { findOne: jest.fn().mockResolvedValue(buildPet()) } as unknown as PetsService;
}

function buildReminderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: REMINDER_ID,
    petId: PET_ID,
    type: "CUSTOM",
    title: "Monthly check",
    rrule: "FREQ=MONTHLY;BYMONTHDAY=15",
    timezone: "Asia/Kolkata",
    startAt: new Date("2026-06-01T03:30:00.000Z"), // 09:00 IST / 23:30 EDT (prior day) in America/New_York
    nextFireAt: new Date("2026-06-15T03:30:00.000Z"),
    medNameAsEntered: null,
    medDoseAsEntered: null,
    active: true,
    templateKey: null,
    courseId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildPrisma(overrides: {
  findMany?: jest.Mock;
  findFirst?: jest.Mock;
  eventFindMany?: jest.Mock;
  eventUpsert?: jest.Mock;
}): PrismaService {
  return {
    reminder: {
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      findFirst: overrides.findFirst ?? jest.fn(),
    },
    reminderEvent: {
      findMany: overrides.eventFindMany ?? jest.fn().mockResolvedValue([]),
      upsert: overrides.eventUpsert ?? jest.fn(),
    },
  } as unknown as PrismaService;
}

describe("RemindersService tz-change sweep", () => {
  describe("agenda", () => {
    it("agenda over a fixed window neither duplicates nor drops an occurrence when the reminder timezone is changed", async () => {
      // Same rrule/startAt (MONTHLY;BYMONTHDAY=15) with tz Kolkata; the
      // anchor's own day (Jun 1) never matches BYMONTHDAY=15, so the FIRST
      // (and only) occurrence in this window is the "real" June 15th one.
      const kolkataReminder = buildReminderRow({ timezone: "Asia/Kolkata" });
      const findManyKolkata = jest.fn().mockResolvedValue([kolkataReminder]);
      const prismaKolkata = buildPrisma({ findMany: findManyKolkata });
      const serviceKolkata = new RemindersService(prismaKolkata, buildPetsService());

      const window = { from: "2026-06-14T00:00:00.000Z", to: "2026-06-17T00:00:00.000Z" };
      const resultKolkata = await serviceKolkata.agenda(HOUSEHOLD_ID, window);

      expect(resultKolkata.entries).toHaveLength(1);
      expect(Number.isNaN(resultKolkata.entries[0]!.dueAt.getTime())).toBe(false);
      expect(resultKolkata.entries[0]!.dueAt).toEqual(new Date("2026-06-15T03:30:00.000Z")); // 09:00 IST

      // Simulate the SAME reminder (identical rrule/startAt) after its
      // timezone was changed to America/New_York (RemindersService.update
      // leaves `startAt` untouched when only `timezone` is patched).
      const nyReminder = buildReminderRow({ timezone: "America/New_York" });
      const findManyNy = jest.fn().mockResolvedValue([nyReminder]);
      const prismaNy = buildPrisma({ findMany: findManyNy });
      const serviceNy = new RemindersService(prismaNy, buildPetsService());

      const resultNy = await serviceNy.agenda(HOUSEHOLD_ID, window);

      // Same window, no drop and no duplicate -- exactly one entry, correctly recomputed for the new tz.
      expect(resultNy.entries).toHaveLength(1);
      expect(Number.isNaN(resultNy.entries[0]!.dueAt.getTime())).toBe(false);
      expect(resultNy.entries[0]!.dueAt).toEqual(new Date("2026-06-16T03:30:00.000Z")); // 23:30 EDT (Jun 15 local)

      // Genuinely distinct instants -- not accidentally the same UTC epoch keyed twice.
      expect(resultNy.entries[0]!.dueAt.getTime()).not.toBe(resultKolkata.entries[0]!.dueAt.getTime());
    });
  });

  describe("assertOccurrence (via completeOccurrence)", () => {
    it("completes a genuine new-tz occurrence after the reminder's timezone was changed", async () => {
      const nyReminder = buildReminderRow({ timezone: "America/New_York" });
      const dueAt = new Date("2026-06-16T03:30:00.000Z"); // the genuine post-tz-change occurrence
      const findFirst = jest.fn().mockResolvedValue(nyReminder);
      const upsert = jest.fn().mockResolvedValue({
        id: "event-1",
        reminderId: REMINDER_ID,
        dueAt,
        status: "DONE",
        completedAt: new Date(),
        snoozedUntil: null,
      });
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: dueAt.toISOString() });

      expect(result.status).toBe("DONE");
      expect(upsert).toHaveBeenCalledWith({
        where: { reminderId_dueAt: { reminderId: REMINDER_ID, dueAt } },
        create: { reminderId: REMINDER_ID, dueAt, status: "DONE", completedAt: expect.any(Date), snoozedUntil: null },
        update: { status: "DONE", completedAt: expect.any(Date), snoozedUntil: null },
      });
    });

    it("a stale pre-tz-change instant is no longer a genuine occurrence -- throws 400, no upsert", async () => {
      const nyReminder = buildReminderRow({ timezone: "America/New_York" });
      const staleDueAt = new Date("2026-06-15T03:30:00.000Z"); // the old Kolkata-tz instant
      const findFirst = jest.fn().mockResolvedValue(nyReminder);
      const upsert = jest.fn();
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: staleDueAt.toISOString() }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(upsert).not.toHaveBeenCalled();
    });
  });
});
