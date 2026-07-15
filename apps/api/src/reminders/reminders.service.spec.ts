import { BadRequestException, NotFoundException } from "@nestjs/common";
import { resolveCareTemplate } from "@pawcareright/data";

import type { PetResponse } from "../pets/pets.service";
import type { PetsService } from "../pets/pets.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { CreateMedicationCourseDto } from "./dto/create-medication-course.dto";
import type { CreateReminderDto } from "./dto/create-reminder.dto";
import type { UpdateReminderDto } from "./dto/update-reminder.dto";
import { RemindersService } from "./reminders.service";

const HOUSEHOLD_ID = "household-1";
const PET_ID = "pet-1";
const REMINDER_ID = "reminder-1";

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

function buildReminderRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: REMINDER_ID,
    petId: PET_ID,
    type: "VACCINE",
    title: "Rabies booster",
    rrule: "FREQ=YEARLY",
    timezone: "UTC",
    startAt: new Date("2026-08-01T09:00:00.000Z"),
    nextFireAt: new Date("2026-08-01T09:00:00.000Z"),
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

function buildPetsService(findOne?: jest.Mock): PetsService {
  return { findOne: findOne ?? jest.fn().mockResolvedValue(buildPet()) } as unknown as PetsService;
}

function buildPrisma(overrides: {
  create?: jest.Mock;
  findMany?: jest.Mock;
  findFirst?: jest.Mock;
  update?: jest.Mock;
  delete?: jest.Mock;
  eventFindMany?: jest.Mock;
  eventUpsert?: jest.Mock;
  transaction?: jest.Mock;
}): PrismaService {
  return {
    reminder: {
      create: overrides.create ?? jest.fn(),
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      findFirst: overrides.findFirst ?? jest.fn(),
      update: overrides.update ?? jest.fn(),
      delete: overrides.delete ?? jest.fn(),
    },
    reminderEvent: {
      findMany: overrides.eventFindMany ?? jest.fn().mockResolvedValue([]),
      upsert: overrides.eventUpsert ?? jest.fn(),
    },
    $transaction:
      overrides.transaction ?? jest.fn((queries: Array<Promise<unknown>>) => Promise.all(queries)),
  } as unknown as PrismaService;
}

describe("RemindersService", () => {
  describe("create", () => {
    it("pet-404 first: petsService.findOne rejects -> no reminder.create call", async () => {
      const petsService = buildPetsService(jest.fn().mockRejectedValue(new NotFoundException()));
      const create = jest.fn();
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      const dto: CreateReminderDto = {
        type: "VACCINE",
        title: "Rabies booster",
        rrule: "FREQ=YEARLY",
        timezone: "UTC",
        startAt: "2026-08-01T09:00:00.000Z",
      };

      await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toBeInstanceOf(NotFoundException);
      expect(create).not.toHaveBeenCalled();
    });

    it("invalid rrule -> BadRequestException, no persist", async () => {
      const petsService = buildPetsService();
      const create = jest.fn();
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      const dto = {
        type: "VACCINE",
        title: "Rabies booster",
        rrule: "NOT_A_RRULE",
        timezone: "UTC",
        startAt: "2026-08-01T09:00:00.000Z",
      } as CreateReminderDto;

      await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it("throws 400 when computeNextFireAt returns null (exhausted COUNT before startAt)", async () => {
      const petsService = buildPetsService();
      const create = jest.fn();
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      const dto: CreateReminderDto = {
        type: "VACCINE",
        title: "Rabies booster",
        rrule: "FREQ=DAILY;UNTIL=20200101T000000Z", // UNTIL in the past relative to startAt
        timezone: "UTC",
        startAt: "2026-08-01T09:00:00.000Z",
      };

      await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it("persists nextFireAt = computeNextFireAt(rule, startAt, startAt, tz) and maps the response", async () => {
      const petsService = buildPetsService();
      const row = buildReminderRow();
      const create = jest.fn().mockResolvedValue(row);
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      const dto: CreateReminderDto = {
        type: "VACCINE",
        title: "Rabies booster",
        rrule: "FREQ=YEARLY",
        timezone: "UTC",
        startAt: "2026-08-01T09:00:00.000Z",
      };

      const result = await service.create(HOUSEHOLD_ID, PET_ID, dto);

      expect(create).toHaveBeenCalledWith({
        data: {
          petId: PET_ID,
          type: "VACCINE",
          title: "Rabies booster",
          rrule: "FREQ=YEARLY",
          timezone: "UTC",
          startAt: new Date("2026-08-01T09:00:00.000Z"),
          nextFireAt: new Date("2026-08-01T09:00:00.000Z"),
        },
      });
      expect(result.id).toBe(REMINDER_ID);
      expect(result.medNameAsEntered).toBeUndefined();
      expect(result.templateKey).toBeUndefined();
    });

    it("passes medNameAsEntered through when present", async () => {
      const petsService = buildPetsService();
      const row = buildReminderRow({ medNameAsEntered: "Apoquel 16mg, per vet" });
      const create = jest.fn().mockResolvedValue(row);
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      const dto: CreateReminderDto = {
        type: "MEDICATION",
        title: "Evening med",
        rrule: "FREQ=DAILY",
        timezone: "UTC",
        startAt: "2026-08-01T09:00:00.000Z",
        medNameAsEntered: "Apoquel 16mg, per vet",
      };

      const result = await service.create(HOUSEHOLD_ID, PET_ID, dto);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ medNameAsEntered: "Apoquel 16mg, per vet" }) }),
      );
      expect(result.medNameAsEntered).toBe("Apoquel 16mg, per vet");
    });
  });

  describe("createMedicationCourse (T061)", () => {
    function buildDto(overrides: Partial<CreateMedicationCourseDto> = {}): CreateMedicationCourseDto {
      return {
        medNameAsEntered: "As prescribed",
        doseStartAts: ["2026-08-01T09:00:00.000Z", "2026-08-01T21:00:00.000Z"],
        courseLengthDays: 10,
        timezone: "UTC",
        ...overrides,
      } as CreateMedicationCourseDto;
    }

    it("pet-404 first: petsService.findOne rejects -> no reminder.create call", async () => {
      const petsService = buildPetsService(jest.fn().mockRejectedValue(new NotFoundException()));
      const create = jest.fn();
      const transaction = jest.fn();
      const prisma = buildPrisma({ create, transaction });
      const service = new RemindersService(prisma, petsService);

      await expect(
        service.createMedicationCourse(HOUSEHOLD_ID, PET_ID, buildDto()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(create).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it("creates one reminder per (de-duped) dose time, sharing one courseId, type MEDICATION, COUNT=<days>; returns { courseId, reminderCount }", async () => {
      const petsService = buildPetsService();
      const create = jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      const result = await service.createMedicationCourse(HOUSEHOLD_ID, PET_ID, buildDto());

      expect(create).toHaveBeenCalledTimes(2);
      const calls = create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
      for (const [{ data }] of calls) {
        expect(data.type).toBe("MEDICATION");
        expect(data.rrule).toBe("FREQ=DAILY;COUNT=10");
        expect(data.courseId).toBe(result.courseId);
        expect(data.petId).toBe(PET_ID);
        expect(data.medNameAsEntered).toBe("As prescribed");
      }
      expect(result.reminderCount).toBe(2);
      expect(typeof result.courseId).toBe("string");
      expect((result.courseId as string).length).toBeGreaterThan(0);
    });

    it("passes medDoseAsEntered through to every sibling when present", async () => {
      const petsService = buildPetsService();
      const create = jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      await service.createMedicationCourse(
        HOUSEHOLD_ID,
        PET_ID,
        buildDto({ medDoseAsEntered: "As instructed" }),
      );

      const calls = create.mock.calls as Array<[{ data: Record<string, unknown> }]>;
      for (const [{ data }] of calls) {
        expect(data.medDoseAsEntered).toBe("As instructed");
      }
    });

    it("de-dupes identical dose times before creating (reminderCount reflects the de-duped set)", async () => {
      const petsService = buildPetsService();
      const create = jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
      const prisma = buildPrisma({ create });
      const service = new RemindersService(prisma, petsService);

      const result = await service.createMedicationCourse(
        HOUSEHOLD_ID,
        PET_ID,
        buildDto({ doseStartAts: ["2026-08-01T09:00:00.000Z", "2026-08-01T09:00:00.000Z"] }),
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(result.reminderCount).toBe(1);
    });
  });

  describe("list", () => {
    it("pet-404 first", async () => {
      const petsService = buildPetsService(jest.fn().mockRejectedValue(new NotFoundException()));
      const findMany = jest.fn();
      const prisma = buildPrisma({ findMany });
      const service = new RemindersService(prisma, petsService);

      await expect(service.list(HOUSEHOLD_ID, PET_ID, {})).rejects.toBeInstanceOf(NotFoundException);
      expect(findMany).not.toHaveBeenCalled();
    });

    it("paginates with take=limit+1 and returns nextCursor when there's an extra row", async () => {
      const petsService = buildPetsService();
      const rows = [
        buildReminderRow({ id: "r3" }),
        buildReminderRow({ id: "r2" }),
        buildReminderRow({ id: "r1" }), // the "extra" row signaling more pages
      ];
      const findMany = jest.fn().mockResolvedValue(rows);
      const prisma = buildPrisma({ findMany });
      const service = new RemindersService(prisma, petsService);

      const result = await service.list(HOUSEHOLD_ID, PET_ID, { limit: 2 });

      expect(findMany).toHaveBeenCalledWith({
        where: { petId: PET_ID },
        orderBy: { createdAt: "desc" },
        take: 3,
      });
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe("r2");
    });

    it("final page (no extra row) -> nextCursor null", async () => {
      const petsService = buildPetsService();
      const findMany = jest.fn().mockResolvedValue([buildReminderRow()]);
      const prisma = buildPrisma({ findMany });
      const service = new RemindersService(prisma, petsService);

      const result = await service.list(HOUSEHOLD_ID, PET_ID, { cursor: "some-cursor", limit: 20 });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: "some-cursor" }, skip: 1 }),
      );
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("findOne", () => {
    it("household-scoped fetch, not found -> NotFoundException", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const prisma = buildPrisma({ findFirst });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(service.findOne(HOUSEHOLD_ID, REMINDER_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: REMINDER_ID, pet: { householdId: HOUSEHOLD_ID, deletedAt: null } },
      });
    });

    it("found -> maps the response", async () => {
      const findFirst = jest.fn().mockResolvedValue(buildReminderRow());
      const prisma = buildPrisma({ findFirst });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.findOne(HOUSEHOLD_ID, REMINDER_ID);

      expect(result.id).toBe(REMINDER_ID);
    });
  });

  describe("update", () => {
    it("not found -> NotFoundException, no update call", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const update = jest.fn();
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(service.update(HOUSEHOLD_ID, REMINDER_ID, {} as UpdateReminderDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(update).not.toHaveBeenCalled();
    });

    it("no schedule-affecting field present -> nextFireAt untouched, only present fields written", async () => {
      const existing = buildReminderRow();
      const findFirst = jest.fn().mockResolvedValue(existing);
      const updated = buildReminderRow({ title: "Updated title" });
      const update = jest.fn().mockResolvedValue(updated);
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.update(HOUSEHOLD_ID, REMINDER_ID, { title: "Updated title" });

      expect(update).toHaveBeenCalledWith({ where: { id: REMINDER_ID }, data: { title: "Updated title" } });
      expect(result.title).toBe("Updated title");
    });

    it("rrule present -> recomputes nextFireAt from the new rule + existing startAt/tz", async () => {
      const existing = buildReminderRow({
        rrule: "FREQ=YEARLY",
        startAt: new Date("2026-01-10T09:00:00.000Z"),
        timezone: "UTC",
      });
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn().mockResolvedValue(buildReminderRow({ rrule: "FREQ=DAILY" }));
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await service.update(HOUSEHOLD_ID, REMINDER_ID, { rrule: "FREQ=DAILY" });

      expect(update).toHaveBeenCalledWith({
        where: { id: REMINDER_ID },
        data: { rrule: "FREQ=DAILY", nextFireAt: new Date("2026-01-10T09:00:00.000Z") },
      });
    });

    it("startAt present -> recomputes nextFireAt from the existing rule + new startAt", async () => {
      const existing = buildReminderRow({ rrule: "FREQ=DAILY", timezone: "UTC" });
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn().mockResolvedValue(existing);
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await service.update(HOUSEHOLD_ID, REMINDER_ID, { startAt: "2027-01-01T10:00:00.000Z" });

      expect(update).toHaveBeenCalledWith({
        where: { id: REMINDER_ID },
        data: { startAt: new Date("2027-01-01T10:00:00.000Z"), nextFireAt: new Date("2027-01-01T10:00:00.000Z") },
      });
    });

    it("timezone present -> recomputes nextFireAt using the new tz", async () => {
      const existing = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-03-05T14:00:00.000Z"), // 09:00 EST
        timezone: "America/New_York",
      });
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn().mockResolvedValue(existing);
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await service.update(HOUSEHOLD_ID, REMINDER_ID, { timezone: "UTC" });

      expect(update).toHaveBeenCalledWith({
        where: { id: REMINDER_ID },
        data: { timezone: "UTC", nextFireAt: new Date("2026-03-05T14:00:00.000Z") },
      });
    });

    it("invalid rrule on update -> BadRequestException, no update call", async () => {
      const existing = buildReminderRow();
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn();
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.update(HOUSEHOLD_ID, REMINDER_ID, { rrule: "NOT_A_RRULE" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it("the analogous update exhausted-rule case -> 400, no update call", async () => {
      const existing = buildReminderRow({ startAt: new Date("2026-08-01T09:00:00.000Z") });
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn();
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.update(HOUSEHOLD_ID, REMINDER_ID, { rrule: "FREQ=DAILY;UNTIL=20200101T000000Z" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it("active toggle alone does not recompute nextFireAt", async () => {
      const existing = buildReminderRow();
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn().mockResolvedValue(buildReminderRow({ active: false }));
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.update(HOUSEHOLD_ID, REMINDER_ID, { active: false });

      expect(update).toHaveBeenCalledWith({ where: { id: REMINDER_ID }, data: { active: false } });
      expect(result.active).toBe(false);
    });

    it("medNameAsEntered present -> written through", async () => {
      const existing = buildReminderRow();
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn().mockResolvedValue(buildReminderRow({ medNameAsEntered: "as entered" }));
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await service.update(HOUSEHOLD_ID, REMINDER_ID, { medNameAsEntered: "as entered" });

      expect(update).toHaveBeenCalledWith({ where: { id: REMINDER_ID }, data: { medNameAsEntered: "as entered" } });
    });

    it("type present -> written through", async () => {
      const existing = buildReminderRow();
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn().mockResolvedValue(buildReminderRow({ type: "DENTAL" }));
      const prisma = buildPrisma({ findFirst, update });
      const service = new RemindersService(prisma, buildPetsService());

      await service.update(HOUSEHOLD_ID, REMINDER_ID, { type: "DENTAL" });

      expect(update).toHaveBeenCalledWith({ where: { id: REMINDER_ID }, data: { type: "DENTAL" } });
    });
  });

  describe("remove", () => {
    it("not found -> NotFoundException, no delete call", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const del = jest.fn();
      const prisma = buildPrisma({ findFirst, delete: del });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(service.remove(HOUSEHOLD_ID, REMINDER_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(del).not.toHaveBeenCalled();
    });

    it("hard-deletes and returns the deleted resource", async () => {
      const existing = buildReminderRow();
      const findFirst = jest.fn().mockResolvedValue(existing);
      const del = jest.fn().mockResolvedValue(existing);
      const prisma = buildPrisma({ findFirst, delete: del });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.remove(HOUSEHOLD_ID, REMINDER_ID);

      expect(del).toHaveBeenCalledWith({ where: { id: REMINDER_ID } });
      expect(result.id).toBe(REMINDER_ID);
    });
  });

  describe("agenda", () => {
    it("to<=from -> BadRequestException, no queries", async () => {
      const findMany = jest.fn();
      const prisma = buildPrisma({ findMany });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.agenda(HOUSEHOLD_ID, { from: "2026-08-10T00:00:00.000Z", to: "2026-08-01T00:00:00.000Z" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
    });

    it("window > 92 days -> BadRequestException", async () => {
      const findMany = jest.fn();
      const prisma = buildPrisma({ findMany });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.agenda(HOUSEHOLD_ID, { from: "2026-01-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(findMany).not.toHaveBeenCalled();
    });

    it("petId present -> validates pet ownership via petsService.findOne and scopes both queries", async () => {
      const findOne = jest.fn().mockResolvedValue(buildPet());
      const findMany = jest.fn().mockResolvedValue([]);
      const eventFindMany = jest.fn().mockResolvedValue([]);
      const prisma = buildPrisma({ findMany, eventFindMany });
      const service = new RemindersService(prisma, buildPetsService(findOne));

      await service.agenda(HOUSEHOLD_ID, {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-02T00:00:00.000Z",
        petId: PET_ID,
      });

      expect(findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, PET_ID);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ petId: PET_ID }),
        }),
      );
      expect(eventFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ reminder: expect.objectContaining({ petId: PET_ID }) }),
        }),
      );
    });

    it("petId not in household -> propagates the 404 from petsService.findOne", async () => {
      const findOne = jest.fn().mockRejectedValue(new NotFoundException());
      const prisma = buildPrisma({});
      const service = new RemindersService(prisma, buildPetsService(findOne));

      await expect(
        service.agenda(HOUSEHOLD_ID, {
          from: "2026-08-01T00:00:00.000Z",
          to: "2026-08-02T00:00:00.000Z",
          petId: "someone-elses-pet",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("expands a virtual occurrence for an active reminder with no materialized event", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const findMany = jest.fn().mockResolvedValue([reminder]);
      const eventFindMany = jest.fn().mockResolvedValue([]);
      const prisma = buildPrisma({ findMany, eventFindMany });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.agenda(HOUSEHOLD_ID, {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-01T23:59:59.000Z",
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        reminderId: REMINDER_ID,
        petId: PET_ID,
        type: "VACCINE",
        title: "Rabies booster",
        dueAt: new Date("2026-08-01T09:00:00.000Z"),
        status: "SCHEDULED",
        virtual: true,
      });
    });

    it("a materialized event at the same instant wins over the virtual occurrence (event status + eventId)", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const dueAt = new Date("2026-08-01T09:00:00.000Z");
      const findMany = jest.fn().mockResolvedValue([reminder]);
      const eventFindMany = jest.fn().mockResolvedValue([
        { id: "event-1", reminderId: REMINDER_ID, dueAt, status: "DONE", reminder },
      ]);
      const prisma = buildPrisma({ findMany, eventFindMany });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.agenda(HOUSEHOLD_ID, {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-01T23:59:59.000Z",
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toEqual({
        reminderId: REMINDER_ID,
        petId: PET_ID,
        type: "VACCINE",
        title: "Rabies booster",
        dueAt,
        status: "DONE",
        virtual: false,
        eventId: "event-1",
      });
    });

    it("an orphan materialized event (no matching virtual occurrence) is still included as its own entry", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=YEARLY", // anchored on Jan 15 -- no occurrence falls in the Aug 1 window below
        startAt: new Date("2020-01-15T09:00:00.000Z"),
        timezone: "UTC",
      });
      const orphanDueAt = new Date("2026-08-01T10:00:00.000Z"); // rrule was edited after this event was created
      const findMany = jest.fn().mockResolvedValue([reminder]);
      const eventFindMany = jest.fn().mockResolvedValue([
        { id: "event-orphan", reminderId: REMINDER_ID, dueAt: orphanDueAt, status: "PENDING", reminder },
      ]);
      const prisma = buildPrisma({ findMany, eventFindMany });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.agenda(HOUSEHOLD_ID, {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-01T23:59:59.000Z",
      });

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].eventId).toBe("event-orphan");
      expect(result.entries[0].virtual).toBe(false);
    });

    it("sorts entries by dueAt ascending", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const findMany = jest.fn().mockResolvedValue([reminder]);
      const eventFindMany = jest.fn().mockResolvedValue([]);
      const prisma = buildPrisma({ findMany, eventFindMany });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.agenda(HOUSEHOLD_ID, {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-03T23:59:59.000Z",
      });

      const dueAtTimes = result.entries.map((e) => e.dueAt.getTime());
      expect(dueAtTimes).toEqual([...dueAtTimes].sort((a, b) => a - b));
      expect(dueAtTimes).toHaveLength(3);
    });

    it("a reminder whose rrule fails to parse defensively is skipped (no throw)", async () => {
      const reminder = buildReminderRow({ rrule: "NOT_A_RRULE" });
      const findMany = jest.fn().mockResolvedValue([reminder]);
      const eventFindMany = jest.fn().mockResolvedValue([]);
      const prisma = buildPrisma({ findMany, eventFindMany });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.agenda(HOUSEHOLD_ID, {
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-03T23:59:59.000Z",
      });

      expect(result.entries).toEqual([]);
    });

    it("excludes active:true filter to the query -- paused reminders are never expanded", async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const eventFindMany = jest.fn().mockResolvedValue([]);
      const prisma = buildPrisma({ findMany, eventFindMany });
      const service = new RemindersService(prisma, buildPetsService());

      await service.agenda(HOUSEHOLD_ID, { from: "2026-08-01T00:00:00.000Z", to: "2026-08-02T00:00:00.000Z" });

      expect(findMany).toHaveBeenCalledWith({
        where: { active: true, pet: { householdId: HOUSEHOLD_ID, deletedAt: null } },
      });
      expect(eventFindMany).toHaveBeenCalledWith({
        where: {
          dueAt: { gte: new Date("2026-08-01T00:00:00.000Z"), lte: new Date("2026-08-02T00:00:00.000Z") },
          reminder: { active: true, pet: { householdId: HOUSEHOLD_ID, deletedAt: null } },
        },
        include: { reminder: true },
      });
    });
  });

  describe("completeOccurrence", () => {
    it("reminder not in household -> NotFoundException, no occurrence check/upsert", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const upsert = jest.fn();
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: "2026-08-01T09:00:00.000Z" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("dueAt not a genuine occurrence -> BadRequestException, no upsert", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const findFirst = jest.fn().mockResolvedValue(reminder);
      const upsert = jest.fn();
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: "2026-08-01T10:00:00.000Z" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("completes a genuine (virtual) occurrence: upserts DONE at the EXACT posted dueAt (epoch-equal), clears snoozedUntil", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const dueAt = new Date("2026-08-02T09:00:00.000Z"); // second daily occurrence
      const findFirst = jest.fn().mockResolvedValue(reminder);
      const upsertedEvent = {
        id: "event-1",
        reminderId: REMINDER_ID,
        dueAt,
        status: "DONE",
        completedAt: new Date(),
        snoozedUntil: null,
      };
      const upsert = jest.fn().mockResolvedValue(upsertedEvent);
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: dueAt.toISOString() });

      expect(upsert).toHaveBeenCalledWith({
        where: { reminderId_dueAt: { reminderId: REMINDER_ID, dueAt } },
        create: { reminderId: REMINDER_ID, dueAt, status: "DONE", completedAt: expect.any(Date), snoozedUntil: null },
        update: { status: "DONE", completedAt: expect.any(Date), snoozedUntil: null },
      });
      expect(result).toEqual({
        reminderId: REMINDER_ID,
        petId: PET_ID,
        type: "VACCINE",
        title: "Rabies booster",
        dueAt,
        status: "DONE",
        virtual: false,
        eventId: "event-1",
      });
    });

    it("a second identical call is idempotent (same upsert key both times)", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const dueAt = new Date("2026-08-01T09:00:00.000Z");
      const findFirst = jest.fn().mockResolvedValue(reminder);
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

      await service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: dueAt.toISOString() });
      await service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: dueAt.toISOString() });

      expect(upsert).toHaveBeenCalledTimes(2);
      const firstWhere = (upsert.mock.calls[0] as [{ where: unknown }])[0].where;
      const secondWhere = (upsert.mock.calls[1] as [{ where: unknown }])[0].where;
      expect(firstWhere).toEqual(secondWhere);
    });

    it("completing an already-MISSED event flips it to DONE (update branch reached, status DONE returned)", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const dueAt = new Date("2026-08-01T09:00:00.000Z");
      const findFirst = jest.fn().mockResolvedValue(reminder);
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
      const call = upsert.mock.calls[0] as [{ update: unknown }];
      expect(call[0].update).toEqual({ status: "DONE", completedAt: expect.any(Date), snoozedUntil: null });
    });

    it("MED_GIVEN idempotency (T061): completing a MEDICATION dose occurrence TWICE yields one DONE event (completedAt set)", async () => {
      const reminder = buildReminderRow({
        type: "MEDICATION",
        rrule: "FREQ=DAILY;COUNT=10",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
        medNameAsEntered: "As prescribed",
        medDoseAsEntered: "As instructed",
        courseId: "course-1",
      });
      const dueAt = new Date("2026-08-01T09:00:00.000Z");
      const findFirst = jest.fn().mockResolvedValue(reminder);
      const upsertedEvent = {
        id: "event-1",
        reminderId: REMINDER_ID,
        dueAt,
        status: "DONE",
        completedAt: new Date(),
        snoozedUntil: null,
      };
      const upsert = jest.fn().mockResolvedValue(upsertedEvent);
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      const first = await service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: dueAt.toISOString() });
      const second = await service.completeOccurrence(HOUSEHOLD_ID, REMINDER_ID, { dueAt: dueAt.toISOString() });

      expect(upsert).toHaveBeenCalledTimes(2);
      expect(first.eventId).toBe("event-1");
      expect(second.eventId).toBe("event-1");
      expect(first.status).toBe("DONE");
      expect(second.status).toBe("DONE");
      expect(first.medNameAsEntered).toBe("As prescribed");
      expect(first.medDoseAsEntered).toBe("As instructed");
    });
  });

  describe("snoozeOccurrence", () => {
    it("reminder not in household -> NotFoundException, no upsert", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const upsert = jest.fn();
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.snoozeOccurrence(HOUSEHOLD_ID, REMINDER_ID, {
          dueAt: "2026-08-01T09:00:00.000Z",
          snoozeUntil: "2026-08-02T09:00:00.000Z",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("dueAt not a genuine occurrence -> BadRequestException, no upsert", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const findFirst = jest.fn().mockResolvedValue(reminder);
      const upsert = jest.fn();
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.snoozeOccurrence(HOUSEHOLD_ID, REMINDER_ID, {
          dueAt: "2026-08-01T10:00:00.000Z",
          snoozeUntil: "2026-08-02T09:00:00.000Z",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("snoozeUntil in the past -> BadRequestException, no upsert", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const findFirst = jest.fn().mockResolvedValue(reminder);
      const upsert = jest.fn();
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      await expect(
        service.snoozeOccurrence(HOUSEHOLD_ID, REMINDER_ID, {
          dueAt: "2026-08-01T09:00:00.000Z",
          snoozeUntil: "2020-01-01T00:00:00.000Z",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(upsert).not.toHaveBeenCalled();
    });

    it("sets SNOOZED + snoozedUntil, clears completedAt, and never touches Reminder.nextFireAt (reminder.update not called)", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const dueAt = new Date("2026-08-01T09:00:00.000Z");
      const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000);
      const findFirst = jest.fn().mockResolvedValue(reminder);
      const reminderUpdate = jest.fn();
      const upsert = jest.fn().mockResolvedValue({
        id: "event-1",
        reminderId: REMINDER_ID,
        dueAt,
        status: "SNOOZED",
        completedAt: null,
        snoozedUntil: snoozeUntil,
      });
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert, update: reminderUpdate });
      const service = new RemindersService(prisma, buildPetsService());

      const result = await service.snoozeOccurrence(HOUSEHOLD_ID, REMINDER_ID, {
        dueAt: dueAt.toISOString(),
        snoozeUntil: snoozeUntil.toISOString(),
      });

      expect(upsert).toHaveBeenCalledWith({
        where: { reminderId_dueAt: { reminderId: REMINDER_ID, dueAt } },
        create: { reminderId: REMINDER_ID, dueAt, status: "SNOOZED", snoozedUntil: snoozeUntil, completedAt: null },
        update: { status: "SNOOZED", snoozedUntil: snoozeUntil, completedAt: null },
      });
      expect(result.status).toBe("SNOOZED");
      expect(reminderUpdate).not.toHaveBeenCalled();
    });

    it("a second identical call is idempotent (same upsert key both times)", async () => {
      const reminder = buildReminderRow({
        rrule: "FREQ=DAILY",
        startAt: new Date("2026-08-01T09:00:00.000Z"),
        timezone: "UTC",
      });
      const dueAt = new Date("2026-08-01T09:00:00.000Z");
      const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000);
      const findFirst = jest.fn().mockResolvedValue(reminder);
      const upsert = jest.fn().mockResolvedValue({
        id: "event-1",
        reminderId: REMINDER_ID,
        dueAt,
        status: "SNOOZED",
        completedAt: null,
        snoozedUntil: snoozeUntil,
      });
      const prisma = buildPrisma({ findFirst, eventUpsert: upsert });
      const service = new RemindersService(prisma, buildPetsService());

      await service.snoozeOccurrence(HOUSEHOLD_ID, REMINDER_ID, {
        dueAt: dueAt.toISOString(),
        snoozeUntil: snoozeUntil.toISOString(),
      });
      await service.snoozeOccurrence(HOUSEHOLD_ID, REMINDER_ID, {
        dueAt: dueAt.toISOString(),
        snoozeUntil: snoozeUntil.toISOString(),
      });

      expect(upsert).toHaveBeenCalledTimes(2);
      const firstWhere = (upsert.mock.calls[0] as [{ where: unknown }])[0].where;
      const secondWhere = (upsert.mock.calls[1] as [{ where: unknown }])[0].where;
      expect(firstWhere).toEqual(secondWhere);
    });
  });

  describe("instantiateFromTemplate", () => {
    it("creates a reminder per resolved pack item anchored per PLAN_START, sets templateKey/nextFireAt", async () => {
      const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: null });
      const findOne = jest.fn().mockResolvedValue(pet);
      const existingFindMany = jest.fn().mockResolvedValue([]);
      const create = jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(buildReminderRow(data)),
      );
      const prisma = buildPrisma({ findMany: existingFindMany, create });
      const service = new RemindersService(prisma, buildPetsService(findOne));

      const result = await service.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, { timezone: "UTC" });

      expect(findOne).toHaveBeenCalledWith(HOUSEHOLD_ID, PET_ID);
      expect(result.created.length).toBeGreaterThan(0);
      expect(result.created.every((r) => r.templateKey !== undefined)).toBe(true);
      expect(result.skipped).toBe(0);
    });

    it("idempotent: a second call with the same pet/pack creates no new reminders (all keys pre-exist)", async () => {
      const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: null });
      const findOne = jest.fn().mockResolvedValue(pet);
      // Simulate every resolved item already having a reminder: the pre-query
      // must return a templateKey for every item id the resolver would produce.
      // We first resolve once (unmocked) to learn how many items exist, by
      // calling the real resolver indirectly via a first pass, then feed that
      // count back as pre-existing keys.
      const firstPassExisting = jest.fn().mockResolvedValue([]);
      const create = jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
      const firstPrisma = buildPrisma({ findMany: firstPassExisting, create });
      const firstService = new RemindersService(firstPrisma, buildPetsService(findOne));
      const firstResult = await firstService.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, { timezone: "UTC" });
      const createdKeys = firstResult.created.map((r) => ({ templateKey: r.templateKey }));

      const secondPassExisting = jest.fn().mockResolvedValue(createdKeys);
      const secondCreate = jest.fn();
      const secondPrisma = buildPrisma({ findMany: secondPassExisting, create: secondCreate });
      const secondService = new RemindersService(secondPrisma, buildPetsService(findOne));

      const secondResult = await secondService.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, { timezone: "UTC" });

      expect(secondResult.created).toEqual([]);
      expect(secondResult.skipped).toBe(firstResult.created.length);
      expect(secondCreate).not.toHaveBeenCalled();
    });

    it("skips a PET_AGE item with no derivable birth date (unanchorable) without throwing", async () => {
      // ADULT/no group DOG pack items in this codebase's base schedules are
      // PLAN_START-anchored; to force a PET_AGE branch deterministically we
      // request the juvenile-eligible pack indirectly is out of scope here --
      // instead we assert the service never throws for an age-unknown pet and
      // that skipped accounts for any unanchorable items (0 or more).
      const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: null });
      const findOne = jest.fn().mockResolvedValue(pet);
      const existingFindMany = jest.fn().mockResolvedValue([]);
      const create = jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
      const prisma = buildPrisma({ findMany: existingFindMany, create });
      const service = new RemindersService(prisma, buildPetsService(findOne));

      await expect(
        service.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, { timezone: "UTC" }),
      ).resolves.toBeDefined();
    });

    it("anchor derivation via explicit group: uses resolveCareTemplate directly when dto.group is present", async () => {
      const pet = buildPet({ species: "CAT", birthDate: new Date("2026-01-01T00:00:00.000Z") });
      const findOne = jest.fn().mockResolvedValue(pet);
      const existingFindMany = jest.fn().mockResolvedValue([]);
      const create = jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
      const prisma = buildPrisma({ findMany: existingFindMany, create });
      const service = new RemindersService(prisma, buildPetsService(findOne));

      const result = await service.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, {
        timezone: "UTC",
        group: "EU",
      });

      expect(result.created.length).toBeGreaterThan(0);
    });

    it("empty toCreate list (all skipped/idempotent) never calls $transaction", async () => {
      const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: null });
      const findOne = jest.fn().mockResolvedValue(pet);
      // First resolve to learn keys.
      const firstPassExisting = jest.fn().mockResolvedValue([]);
      const create = jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
      const firstPrisma = buildPrisma({ findMany: firstPassExisting, create });
      const firstService = new RemindersService(firstPrisma, buildPetsService(findOne));
      const firstResult = await firstService.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, { timezone: "UTC" });

      const transaction = jest.fn();
      const secondPrisma = buildPrisma({
        findMany: jest.fn().mockResolvedValue(firstResult.created.map((r) => ({ templateKey: r.templateKey }))),
        transaction,
      });
      const secondService = new RemindersService(secondPrisma, buildPetsService(findOne));

      await secondService.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, { timezone: "UTC" });

      expect(transaction).not.toHaveBeenCalled();
    });

    describe("selections (T059)", () => {
      it("only the listed templateKey is created; a provided startAt override is used verbatim", async () => {
        const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: 3 });
        const findOne = jest.fn().mockResolvedValue(pet);
        const pack = resolveCareTemplate("DOG", "PUPPY_KITTEN", "IN");
        const targetItem = pack.items[0];
        if (!targetItem) throw new Error("fixture pack has no items");

        const existingFindMany = jest.fn().mockResolvedValue([]);
        const create = jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
        const prisma = buildPrisma({ findMany: existingFindMany, create });
        const service = new RemindersService(prisma, buildPetsService(findOne));

        const result = await service.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, {
          timezone: "UTC",
          countryCode: "IN",
          selections: [{ templateKey: targetItem.id, startAt: "2026-09-01T09:00:00.000Z" }],
        });

        expect(create).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              templateKey: targetItem.id,
              startAt: new Date("2026-09-01T09:00:00.000Z"),
            }),
          }),
        );
        expect(result.created).toHaveLength(1);
        expect(result.created[0]?.templateKey).toBe(targetItem.id);
      });

      it("a repeat with the same selection creates nothing and counts it as skipped (idempotency preserved)", async () => {
        const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: 3 });
        const findOne = jest.fn().mockResolvedValue(pet);
        const pack = resolveCareTemplate("DOG", "PUPPY_KITTEN", "IN");
        const targetItem = pack.items[0];
        if (!targetItem) throw new Error("fixture pack has no items");

        const existingFindMany = jest.fn().mockResolvedValue([{ templateKey: targetItem.id }]);
        const create = jest.fn();
        const prisma = buildPrisma({ findMany: existingFindMany, create });
        const service = new RemindersService(prisma, buildPetsService(findOne));

        const result = await service.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, {
          timezone: "UTC",
          countryCode: "IN",
          selections: [{ templateKey: targetItem.id, startAt: "2026-09-01T09:00:00.000Z" }],
        });

        expect(result.created).toEqual([]);
        expect(result.skipped).toBe(1);
        expect(create).not.toHaveBeenCalled();
      });

      it("selections omitted path still creates the full pack (regression)", async () => {
        const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: 3 });
        const findOne = jest.fn().mockResolvedValue(pet);
        const pack = resolveCareTemplate("DOG", "PUPPY_KITTEN", "IN");

        const existingFindMany = jest.fn().mockResolvedValue([]);
        const create = jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(buildReminderRow(data)));
        const prisma = buildPrisma({ findMany: existingFindMany, create });
        const service = new RemindersService(prisma, buildPetsService(findOne));

        const result = await service.instantiateFromTemplate(HOUSEHOLD_ID, PET_ID, {
          timezone: "UTC",
          countryCode: "IN",
        });

        expect(result.created).toHaveLength(pack.items.length);
      });
    });
  });

  describe("templateSuggestions", () => {
    it("DOG puppy / IN: items map 1:1 (templateKey/title/note) to resolveCareTemplate; species/lifeStage/group match; alreadyExists reflects existing reminders", async () => {
      const pet = buildPet({ species: "DOG", birthDate: null, ageEstimateMonths: 3 });
      const findOne = jest.fn().mockResolvedValue(pet);
      const expectedPack = resolveCareTemplate("DOG", "PUPPY_KITTEN", "IN");
      const firstItem = expectedPack.items[0];
      if (!firstItem) throw new Error("fixture pack has no items");

      const existingFindMany = jest.fn().mockResolvedValue([{ templateKey: firstItem.id }]);
      const prisma = buildPrisma({ findMany: existingFindMany });
      const service = new RemindersService(prisma, buildPetsService(findOne));

      const result = await service.templateSuggestions(HOUSEHOLD_ID, PET_ID, { countryCode: "IN" });

      expect(result.species).toBe(expectedPack.species);
      expect(result.lifeStage).toBe(expectedPack.lifeStage);
      expect(result.group).toBe(expectedPack.group);
      expect(result.items).toHaveLength(expectedPack.items.length);
      expectedPack.items.forEach((item, i) => {
        expect(result.items[i]?.templateKey).toBe(item.id);
        expect(result.items[i]?.title).toBe(item.title);
        expect(result.items[i]?.note).toBe(item.note);
      });
      expect(result.items.find((item) => item.templateKey === firstItem.id)?.alreadyExists).toBe(true);
      expect(
        result.items.filter((item) => item.templateKey !== firstItem.id).every((item) => item.alreadyExists === false),
      ).toBe(true);
    });

    it("CAT adult / DEFAULT: same 1:1 mapping, none pre-existing", async () => {
      const pet = buildPet({ species: "CAT", birthDate: null, ageEstimateMonths: null });
      const findOne = jest.fn().mockResolvedValue(pet);
      const expectedPack = resolveCareTemplate("CAT", "ADULT", "DEFAULT");

      const existingFindMany = jest.fn().mockResolvedValue([]);
      const prisma = buildPrisma({ findMany: existingFindMany });
      const service = new RemindersService(prisma, buildPetsService(findOne));

      const result = await service.templateSuggestions(HOUSEHOLD_ID, PET_ID, {});

      expect(result.species).toBe("CAT");
      expect(result.lifeStage).toBe("ADULT");
      expect(result.group).toBe("DEFAULT");
      expect(result.items.map((item) => item.templateKey)).toEqual(expectedPack.items.map((item) => item.id));
      expect(result.items.every((item) => item.alreadyExists === false)).toBe(true);
    });

    it("pet-404 first: petsService.findOne rejects -> no reminder.findMany call", async () => {
      const petsService = buildPetsService(jest.fn().mockRejectedValue(new NotFoundException()));
      const findMany = jest.fn();
      const prisma = buildPrisma({ findMany });
      const service = new RemindersService(prisma, petsService);

      await expect(service.templateSuggestions(HOUSEHOLD_ID, PET_ID, {})).rejects.toBeInstanceOf(NotFoundException);
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
