import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { SAFE_FALLBACK, type CompletedIntake, parseIntake } from "@pawcareright/types";
import { Prisma } from "@prisma/client";
import type { Queue } from "bullmq";

import type { PetResponse } from "../pets/pets.service";
import type { PetsService } from "../pets/pets.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { EntitlementResolver } from "../quota/entitlement";
import type { QuotaService } from "../quota/quota.service";
import type { ChecksJobData } from "./checks.contract";
import { ChecksService } from "./checks.service";
import type { CreateCheckDto } from "./dto/create-check.dto";

const HOUSEHOLD_ID = "household-1";
const USER_ID = "user-1";
const PET_ID = "pet-1";

function intake(raw: unknown): CompletedIntake {
  const parsed = parseIntake(raw);
  if (!parsed.ok) {
    throw new Error(`test fixture intake failed to parse: ${parsed.reason}`);
  }
  return parsed.value;
}

function benignIntake(): CompletedIntake {
  return intake({
    category: "not-eating",
    answers: [
      { questionId: "onset", type: "duration", value: 6, unit: "hours" },
      { questionId: "water", type: "single", value: "drinking-normally" },
      { questionId: "energy", type: "scale", value: 4 },
    ],
  });
}

function redFlagIntake(): CompletedIntake {
  return intake({
    category: "breathing",
    answers: [
      { questionId: "onset", type: "duration", value: 10, unit: "minutes" },
      { questionId: "character", type: "single", value: "gasping" },
      { questionId: "gum-color", type: "single", value: "pink" },
      { questionId: "energy", type: "scale", value: 1 },
    ],
  });
}

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

function buildCheckRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "check-1",
    petId: PET_ID,
    createdById: USER_ID,
    status: "QUEUED",
    category: "not-eating",
    intakeJson: {},
    photoKeys: [],
    redFlagHit: false,
    redFlagRuleId: null,
    redFlagPayloadKey: null,
    costMicroUsd: 0,
    failureReason: null,
    idempotencyKey: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    startedAt: null,
    completedAt: null,
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildHarness(opts: { petFindOne?: jest.Mock; quotaConsume?: jest.Mock; resolve?: jest.Mock } = {}) {
  const prismaSymptomCheck = {
    findUnique: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };
  const prisma = { symptomCheck: prismaSymptomCheck } as unknown as PrismaService;

  const petsService = { findOne: opts.petFindOne ?? jest.fn().mockResolvedValue(buildPet()) } as unknown as PetsService;

  const quotaService = {
    consume: opts.quotaConsume ?? jest.fn().mockResolvedValue({ allowed: true, metric: "checks", window: "total", limit: 1, used: 1, remaining: 0, unlimited: false }),
  } as unknown as QuotaService;

  const entitlementResolver: EntitlementResolver = {
    resolve: opts.resolve ?? jest.fn().mockResolvedValue({ tier: "FREE", bypassQuota: false }),
  };

  const add = jest.fn().mockResolvedValue(undefined);
  const queue = { add } as unknown as Queue<ChecksJobData>;

  const service = new ChecksService(prisma, petsService, quotaService, entitlementResolver, queue);

  return { service, prisma, prismaSymptomCheck, petsService, quotaService, entitlementResolver, queue, add };
}

describe("ChecksService.create", () => {
  it("pet not in household -> 404, no other calls made", async () => {
    const petFindOne = jest.fn().mockRejectedValue(new NotFoundException());
    const { service, prismaSymptomCheck, add } = buildHarness({ petFindOne });
    const dto: CreateCheckDto = { intake: benignIntake() };

    await expect(service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, null)).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaSymptomCheck.create).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("invalid intake -> 400 BadRequestException, no persist/enqueue", async () => {
    const { service, prismaSymptomCheck, add } = buildHarness();
    const dto = { intake: { category: "nope", answers: [] } } as unknown as CreateCheckDto;

    await expect(service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, null)).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaSymptomCheck.create).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  describe("red-flag path (D1 — no quota)", () => {
    it("skips quota entirely, persists redFlag fields, and enqueues with jobId = checkId", async () => {
      const quotaConsume = jest.fn();
      const resolve = jest.fn();
      const { service, prismaSymptomCheck, add } = buildHarness({ quotaConsume, resolve });
      const created = buildCheckRow({
        id: "check-rf",
        category: "breathing",
        redFlagHit: true,
        redFlagRuleId: "breathing-difficulty",
        redFlagPayloadKey: "breathing-difficulty",
      });
      prismaSymptomCheck.create.mockResolvedValue(created);

      const dto: CreateCheckDto = { intake: redFlagIntake() };
      const result = await service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, null);

      expect(quotaConsume).not.toHaveBeenCalled();
      expect(resolve).not.toHaveBeenCalled();
      expect(prismaSymptomCheck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          redFlagHit: true,
          redFlagRuleId: "breathing-difficulty",
          redFlagPayloadKey: "breathing-difficulty",
        }),
      });
      expect(add).toHaveBeenCalledWith(
        "triage",
        { checkId: "check-rf" },
        expect.objectContaining({ jobId: "check-rf" }),
      );
      expect(result.redFlag).toEqual({ ruleId: "breathing-difficulty", payloadKey: "breathing-difficulty" });
    });
  });

  describe("non-red-flag path (quota)", () => {
    it("consumes quota, persists with redFlagHit=false, and enqueues with jobId = checkId", async () => {
      const { service, prismaSymptomCheck, quotaService, add } = buildHarness();
      const created = buildCheckRow({ id: "check-normal" });
      prismaSymptomCheck.create.mockResolvedValue(created);

      const dto: CreateCheckDto = { intake: benignIntake() };
      const result = await service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, null);

      expect(quotaService.consume).toHaveBeenCalledWith(USER_ID, "checks", { tier: "FREE", bypassQuota: false });
      expect(prismaSymptomCheck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ redFlagHit: false, redFlagRuleId: null, redFlagPayloadKey: null }),
      });
      expect(add).toHaveBeenCalledWith(
        "triage",
        { checkId: "check-normal" },
        expect.objectContaining({ jobId: "check-normal" }),
      );
      expect(result.redFlag).toBeUndefined();
    });

    it("over-quota -> 402 HttpException, no persist, no enqueue", async () => {
      const quotaConsume = jest.fn().mockResolvedValue({
        allowed: false,
        metric: "checks",
        window: "total",
        limit: 1,
        used: 2,
        remaining: 0,
        unlimited: false,
      });
      const { service, prismaSymptomCheck, add } = buildHarness({ quotaConsume });
      const dto: CreateCheckDto = { intake: benignIntake() };

      const promise = service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, null);
      await expect(promise).rejects.toBeInstanceOf(HttpException);
      await expect(promise).rejects.toMatchObject({ status: 402 });
      expect(prismaSymptomCheck.create).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });
  });

  describe("idempotency (D5/D6)", () => {
    it("existing (createdById, idempotencyKey) row short-circuits before parseIntake/quota/enqueue", async () => {
      const quotaConsume = jest.fn();
      const { service, prismaSymptomCheck, add } = buildHarness({ quotaConsume });
      const existing = buildCheckRow({ id: "check-existing", idempotencyKey: "k1" });
      prismaSymptomCheck.findUnique.mockResolvedValue(existing);

      // Deliberately malformed `intake` — if parseIntake ran, this would throw.
      const dto = { intake: { not: "valid" } } as unknown as CreateCheckDto;
      const result = await service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, "k1");

      expect(result.id).toBe("check-existing");
      expect(prismaSymptomCheck.findUnique).toHaveBeenCalledWith({
        where: { createdById_idempotencyKey: { createdById: USER_ID, idempotencyKey: "k1" } },
      });
      expect(quotaConsume).not.toHaveBeenCalled();
      expect(prismaSymptomCheck.create).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    });

    it("no existing row for the key -> proceeds through the normal flow", async () => {
      const { service, prismaSymptomCheck, add } = buildHarness();
      prismaSymptomCheck.findUnique.mockResolvedValue(null);
      const created = buildCheckRow({ id: "check-new", idempotencyKey: "k2" });
      prismaSymptomCheck.create.mockResolvedValue(created);

      const dto: CreateCheckDto = { intake: benignIntake() };
      const result = await service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, "k2");

      expect(result.id).toBe("check-new");
      expect(add).toHaveBeenCalled();
    });

    it("P2002 race on create -> refetches by (createdById, idempotencyKey) and returns it", async () => {
      const { service, prismaSymptomCheck, add } = buildHarness();
      prismaSymptomCheck.findUnique.mockResolvedValueOnce(null); // pre-check: no existing row yet
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
      prismaSymptomCheck.create.mockRejectedValue(p2002);
      const winner = buildCheckRow({ id: "check-winner", idempotencyKey: "k3" });
      prismaSymptomCheck.findUnique.mockResolvedValueOnce(winner); // post-race refetch

      const dto: CreateCheckDto = { intake: benignIntake() };
      const result = await service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, "k3");

      expect(result.id).toBe("check-winner");
      // Re-enqueuing after a refetch is safe: `jobId = checkId` makes
      // `queue.add` idempotent (BullMQ no-ops on an existing jobId), so the
      // loser enqueuing the winner's checkId again is harmless (D2/plan
      // "Queue contract").
      expect(add).toHaveBeenCalledWith(
        "triage",
        { checkId: "check-winner" },
        expect.objectContaining({ jobId: "check-winner" }),
      );
    });

    it("non-P2002 create error propagates unchanged", async () => {
      const { service, prismaSymptomCheck } = buildHarness();
      prismaSymptomCheck.findUnique.mockResolvedValue(null);
      prismaSymptomCheck.create.mockRejectedValue(new Error("boom"));

      const dto: CreateCheckDto = { intake: benignIntake() };
      await expect(service.create(HOUSEHOLD_ID, USER_ID, PET_ID, dto, "k4")).rejects.toThrow("boom");
    });
  });
});

describe("ChecksService.findOne", () => {
  it("not found -> 404", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findFirst.mockResolvedValue(null);

    await expect(service.findOne(HOUSEHOLD_ID, "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("non-terminal status never includes result, even if a row is joined", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findFirst.mockResolvedValue(
      buildCheckRow({ status: "RUNNING", result: { checkId: "check-1", resultJson: SAFE_FALLBACK } }),
    );

    const result = await service.findOne(HOUSEHOLD_ID, "check-1");
    expect(result.result).toBeUndefined();
  });

  it("terminal status with a valid TriageResult row -> result present", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findFirst.mockResolvedValue(
      buildCheckRow({
        id: "check-done",
        status: "DONE",
        result: { checkId: "check-done", resultJson: SAFE_FALLBACK },
      }),
    );

    const result = await service.findOne(HOUSEHOLD_ID, "check-done");
    expect(result.result).toEqual(SAFE_FALLBACK);
  });

  it("terminal status with an invalid resultJson -> result omitted (defensive)", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findFirst.mockResolvedValue(
      buildCheckRow({
        id: "check-fallback",
        status: "FALLBACK",
        result: { checkId: "check-fallback", resultJson: { urgency: "NOT_A_REAL_TIER" } },
      }),
    );

    const result = await service.findOne(HOUSEHOLD_ID, "check-fallback");
    expect(result.result).toBeUndefined();
  });

  it("redFlag is present iff redFlagHit is true", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findFirst.mockResolvedValue(
      buildCheckRow({ redFlagHit: true, redFlagRuleId: "major-trauma", redFlagPayloadKey: "major-trauma" }),
    );

    const result = await service.findOne(HOUSEHOLD_ID, "check-1");
    expect(result.redFlag).toEqual({ ruleId: "major-trauma", payloadKey: "major-trauma" });
  });
});

describe("ChecksService.list", () => {
  it("pet not in household -> 404", async () => {
    const petFindOne = jest.fn().mockRejectedValue(new NotFoundException());
    const { service } = buildHarness({ petFindOne });

    await expect(service.list(HOUSEHOLD_ID, PET_ID, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it("no extra row -> nextCursor null, all rows returned", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findMany.mockResolvedValue([buildCheckRow({ id: "a" }), buildCheckRow({ id: "b" })]);

    const result = await service.list(HOUSEHOLD_ID, PET_ID, { limit: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it("extra row present -> truncates to limit and sets nextCursor to the last returned item's id", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findMany.mockResolvedValue([
      buildCheckRow({ id: "a" }),
      buildCheckRow({ id: "b" }),
      buildCheckRow({ id: "c" }),
    ]);

    const result = await service.list(HOUSEHOLD_ID, PET_ID, { limit: 2 });
    expect(result.items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.nextCursor).toBe("b");
  });

  it("passes cursor + skip through to Prisma when a cursor is given", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findMany.mockResolvedValue([]);

    await service.list(HOUSEHOLD_ID, PET_ID, { cursor: "b", limit: 2 });

    expect(prismaSymptomCheck.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "b" }, skip: 1, take: 3 }),
    );
  });

  it("defaults to limit 20 when no limit is given", async () => {
    const { service, prismaSymptomCheck } = buildHarness();
    prismaSymptomCheck.findMany.mockResolvedValue([]);

    await service.list(HOUSEHOLD_ID, PET_ID, {});

    expect(prismaSymptomCheck.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21 }));
  });
});
