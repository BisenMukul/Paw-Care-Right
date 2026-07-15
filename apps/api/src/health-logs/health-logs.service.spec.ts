import { BadRequestException } from "@nestjs/common";

import type { PetResponse } from "../pets/pets.service";
import type { PetsService } from "../pets/pets.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { CreateLogDto } from "./dto/create-log.dto";
import type { ListLogsQueryDto } from "./dto/list-logs-query.dto";
import type { WeightSeriesQueryDto } from "./dto/weight-series-query.dto";
import { HealthLogsService } from "./health-logs.service";

const HOUSEHOLD_ID = "household-1";
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

function buildHealthLogRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "hl-1",
    petId: PET_ID,
    kind: "NOTE",
    valueJson: { text: "hello" },
    photoKeys: [] as string[],
    occurredAt: new Date("2026-07-15T09:00:00.000Z"),
    createdAt: new Date("2026-07-15T09:00:00.000Z"),
    updatedAt: new Date("2026-07-15T09:00:00.000Z"),
    ...overrides,
  };
}

function buildReminderEventRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "re-1",
    reminderId: "reminder-1",
    dueAt: new Date("2026-07-15T09:00:00.000Z"),
    status: "DONE",
    sentAt: null,
    completedAt: new Date("2026-07-15T09:00:00.000Z"),
    snoozedUntil: null,
    createdAt: new Date("2026-07-15T09:00:00.000Z"),
    reminder: {
      id: "reminder-1",
      petId: PET_ID,
      type: "MEDICATION",
      medNameAsEntered: "Med A",
      medDoseAsEntered: null,
    },
    ...overrides,
  };
}

function buildHarness(opts: { petFindOne?: jest.Mock } = {}) {
  const healthLog = { create: jest.fn(), findMany: jest.fn() };
  const reminderEvent = { findMany: jest.fn() };
  const prisma = { healthLog, reminderEvent } as unknown as PrismaService;

  const petFindOne = opts.petFindOne ?? jest.fn().mockResolvedValue(buildPet());
  const petsService = { findOne: petFindOne } as unknown as PetsService;

  const service = new HealthLogsService(prisma, petsService);

  return { service, healthLog, reminderEvent, petFindOne };
}

describe("HealthLogsService.create", () => {
  describe("create_rejects_system_kinds", () => {
    it("MED_GIVEN -> 400, no DB write", async () => {
      const { service, healthLog } = buildHarness();
      const dto = {
        kind: "MED_GIVEN",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { reminderEventId: "re-1" },
      } as unknown as CreateLogDto;

      await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(healthLog.create).not.toHaveBeenCalled();
    });

    it("CHECK_REF -> 400, no DB write", async () => {
      const { service, healthLog } = buildHarness();
      const dto = {
        kind: "CHECK_REF",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { checkId: "8400e29b-9c1d-4c1a-9e1a-6b6b6b6b6b6b" },
      } as unknown as CreateLogDto;

      await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(healthLog.create).not.toHaveBeenCalled();
    });
  });

  describe("create_rejects_invalid_value", () => {
    it("WEIGHT with a negative weightGrams -> 400, no DB write", async () => {
      const { service, healthLog } = buildHarness();
      const dto: CreateLogDto = {
        kind: "WEIGHT",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { weightGrams: -5 },
      };

      await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(healthLog.create).not.toHaveBeenCalled();
    });
  });

  describe("create_persists_valid", () => {
    it("VET_VISIT with <=6 photoKeys persists", async () => {
      const { service, healthLog } = buildHarness();
      healthLog.create.mockResolvedValue(
        buildHealthLogRow({
          kind: "VET_VISIT",
          valueJson: { reason: "checkup" },
          photoKeys: ["k1", "k2"],
        }),
      );
      const dto: CreateLogDto = {
        kind: "VET_VISIT",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { reason: "checkup" },
        photoKeys: ["k1", "k2"],
      };

      const result = await service.create(HOUSEHOLD_ID, PET_ID, dto);

      expect(result.kind).toBe("VET_VISIT");
      expect(result.photoKeys).toEqual(["k1", "k2"]);
      expect(healthLog.create).toHaveBeenCalledTimes(1);
    });

    it("more than 6 photoKeys -> 400, no DB write", async () => {
      const { service, healthLog } = buildHarness();
      const dto: CreateLogDto = {
        kind: "VET_VISIT",
        occurredAt: "2026-07-15T09:00:00.000Z",
        value: { reason: "checkup" },
        photoKeys: ["1", "2", "3", "4", "5", "6", "7"],
      };

      await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(healthLog.create).not.toHaveBeenCalled();
    });
  });

  it("404s when the pet is not in the caller's household", async () => {
    const petFindOne = jest.fn().mockRejectedValue(new Error("not found stand-in"));
    const { service } = buildHarness({ petFindOne });
    const dto: CreateLogDto = {
      kind: "NOTE",
      occurredAt: "2026-07-15T09:00:00.000Z",
      value: { text: "hi" },
    };

    await expect(service.create(HOUSEHOLD_ID, PET_ID, dto)).rejects.toThrow();
  });
});

describe("HealthLogsService.list", () => {
  it("list_merges_two_sources_newest_first", async () => {
    const { service, healthLog, reminderEvent } = buildHarness();
    healthLog.findMany.mockResolvedValue([
      buildHealthLogRow({ id: "hl-1", kind: "NOTE", occurredAt: new Date("2026-07-15T12:00:00.000Z") }),
      buildHealthLogRow({ id: "hl-2", kind: "WEIGHT", occurredAt: new Date("2026-07-15T08:00:00.000Z") }),
    ]);
    reminderEvent.findMany.mockResolvedValue([
      buildReminderEventRow({ id: "re-1", completedAt: new Date("2026-07-15T10:00:00.000Z") }),
    ]);

    const result = await service.list(HOUSEHOLD_ID, PET_ID, {} as ListLogsQueryDto);

    expect(result.items.map((i) => i.id)).toEqual(["hl-1", "re-1", "hl-2"]);
    expect(result.items[1]?.kind).toBe("MED_GIVEN");
    expect(result.items[1]?.value).toEqual({ reminderEventId: "re-1", medNameAsEntered: "Med A" });
  });

  it("list_filter_med_given_projects_only", async () => {
    const { service, healthLog, reminderEvent } = buildHarness();
    reminderEvent.findMany.mockResolvedValue([buildReminderEventRow()]);

    const result = await service.list(HOUSEHOLD_ID, PET_ID, { kind: "MED_GIVEN" } as ListLogsQueryDto);

    expect(healthLog.findMany).not.toHaveBeenCalled();
    expect(reminderEvent.findMany).toHaveBeenCalledTimes(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("MED_GIVEN");
  });

  it("list_filter_single_kind_table_only", async () => {
    const { service, healthLog, reminderEvent } = buildHarness();
    healthLog.findMany.mockResolvedValue([buildHealthLogRow({ kind: "WEIGHT" })]);

    const result = await service.list(HOUSEHOLD_ID, PET_ID, { kind: "WEIGHT" } as ListLogsQueryDto);

    expect(reminderEvent.findMany).not.toHaveBeenCalled();
    expect(healthLog.findMany).toHaveBeenCalledTimes(1);
    const where = healthLog.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where["kind"]).toBe("WEIGHT");
    expect(result.items).toHaveLength(1);
  });

  it("list_projection_excludes_non_done_and_null_completed (queried filter shape)", async () => {
    const { service, reminderEvent } = buildHarness();
    reminderEvent.findMany.mockResolvedValue([]);

    await service.list(HOUSEHOLD_ID, PET_ID, { kind: "MED_GIVEN" } as ListLogsQueryDto);

    const where = reminderEvent.findMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where["status"]).toBe("DONE");
    expect(where["completedAt"]).toEqual({ not: null });
    expect(where["reminder"]).toEqual({ petId: PET_ID, type: "MEDICATION" });
  });

  it("list_empty_page -> {items:[], nextCursor:null}", async () => {
    const { service, healthLog, reminderEvent } = buildHarness();
    healthLog.findMany.mockResolvedValue([]);
    reminderEvent.findMany.mockResolvedValue([]);

    const result = await service.list(HOUSEHOLD_ID, PET_ID, {} as ListLogsQueryDto);

    expect(result).toEqual({ items: [], nextCursor: null });
  });

  it("computes nextCursor from the last RETURNED item (not the unreturned extra row)", async () => {
    const { service, healthLog, reminderEvent } = buildHarness();
    // limit 1 -> service fetches take:2 from each source; 2 HealthLog rows come back (hasMore).
    healthLog.findMany.mockResolvedValue([
      buildHealthLogRow({ id: "hl-1", occurredAt: new Date("2026-07-15T12:00:00.000Z") }),
      buildHealthLogRow({ id: "hl-2", occurredAt: new Date("2026-07-15T08:00:00.000Z") }),
    ]);
    reminderEvent.findMany.mockResolvedValue([]);

    const result = await service.list(HOUSEHOLD_ID, PET_ID, { limit: 1 } as ListLogsQueryDto);

    expect(result.items.map((i) => i.id)).toEqual(["hl-1"]);
    expect(result.nextCursor).not.toBeNull();

    const decoded = JSON.parse(Buffer.from(result.nextCursor as string, "base64url").toString("utf8")) as {
      o: string;
      s: number;
      i: string;
    };
    expect(decoded).toEqual({ o: "2026-07-15T12:00:00.000Z", s: 0, i: "hl-1" });
  });

  it("rejects a malformed cursor with 400, not a 500", async () => {
    const { service } = buildHarness();

    await expect(
      service.list(HOUSEHOLD_ID, PET_ID, { cursor: "not-a-valid-cursor!!" } as ListLogsQueryDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("HealthLogsService.weightSeries", () => {
  it("weight_series_ascending_and_downsampled: >200 rows -> sampled true, <=200 ascending points", async () => {
    const { service, healthLog } = buildHarness();
    const rows = Array.from({ length: 250 }, (_, i) => {
      const occurredAt = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000);
      return buildHealthLogRow({ id: `hl-${i}`, kind: "WEIGHT", valueJson: { weightGrams: 10_000 + i }, occurredAt });
    });
    healthLog.findMany.mockResolvedValue(rows);

    const result = await service.weightSeries(HOUSEHOLD_ID, PET_ID, {} as WeightSeriesQueryDto);

    expect(result.sampled).toBe(true);
    expect(result.points.length).toBeLessThanOrEqual(200);
    for (let i = 1; i < result.points.length; i += 1) {
      expect(new Date(result.points[i]!.t).getTime()).toBeGreaterThan(new Date(result.points[i - 1]!.t).getTime());
    }
  });

  it("<=200 rows -> sampled false, all points returned unchanged", async () => {
    const { service, healthLog } = buildHarness();
    const rows = Array.from({ length: 50 }, (_, i) => {
      const occurredAt = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000);
      return buildHealthLogRow({ id: `hl-${i}`, kind: "WEIGHT", valueJson: { weightGrams: 10_000 + i }, occurredAt });
    });
    healthLog.findMany.mockResolvedValue(rows);

    const result = await service.weightSeries(HOUSEHOLD_ID, PET_ID, {} as WeightSeriesQueryDto);

    expect(result.sampled).toBe(false);
    expect(result.points).toHaveLength(50);
  });
});
