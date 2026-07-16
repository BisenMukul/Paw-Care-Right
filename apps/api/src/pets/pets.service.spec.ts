import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { sexSchema, speciesSchema } from "@pawcareright/types";
import { Sex, Species } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";
import type { EntitlementResolver } from "../quota/entitlement";
import type { CreatePetDto } from "./dto/create-pet.dto";
import type { UpdatePetDto } from "./dto/update-pet.dto";
import { PetsService } from "./pets.service";

describe("enum sync — Prisma Species/Sex must mirror packages/types Zod schemas (R1 guardrail)", () => {
  it("Species matches speciesSchema.options", () => {
    expect(Object.values(Species).sort()).toEqual([...speciesSchema.options].sort());
  });

  it("Sex matches sexSchema.options", () => {
    expect(Object.values(Sex).sort()).toEqual([...sexSchema.options].sort());
  });
});

describe("PetsService", () => {
  const householdId = "household-1";
  const id = "pet-1";

  function buildPetRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id,
      householdId,
      species: "DOG",
      breedSlug: null,
      name: "Fido",
      sex: "UNKNOWN",
      neutered: false,
      birthDate: null,
      ageEstimateMonths: null,
      weightGrams: null,
      photoKey: null,
      deletedAt: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
      ...overrides,
    };
  }

  function buildPrisma(overrides: {
    create?: jest.Mock;
    findMany?: jest.Mock;
    findFirst?: jest.Mock;
    update?: jest.Mock;
    count?: jest.Mock;
  }) {
    return {
      pet: {
        create: overrides.create ?? jest.fn(),
        findMany: overrides.findMany ?? jest.fn(),
        findFirst: overrides.findFirst ?? jest.fn(),
        update: overrides.update ?? jest.fn(),
        count: overrides.count ?? jest.fn().mockResolvedValue(0),
      },
    } as unknown as PrismaService;
  }

  function buildResolver(tier: "FREE" | "PREMIUM" = "FREE"): EntitlementResolver {
    return { resolve: jest.fn().mockResolvedValue({ tier, bypassQuota: false }) };
  }

  const userId = "user-1";

  describe("create", () => {
    it("creates scoped to householdId and maps the response", async () => {
      const row = buildPetRow();
      const create = jest.fn().mockResolvedValue(row);
      const prisma = buildPrisma({ create });
      const service = new PetsService(prisma, buildResolver());
      const dto = { species: "DOG", name: "Fido" } as CreatePetDto;

      const result = await service.create(householdId, userId, dto);

      expect(create).toHaveBeenCalledWith({
        data: { householdId, species: "DOG", name: "Fido" },
      });
      expect(result.id).toBe(id);
      expect(result).not.toHaveProperty("deletedAt");
    });

    it("both birthDate and ageEstimateMonths set → BadRequestException, no Prisma call", async () => {
      const create = jest.fn();
      const prisma = buildPrisma({ create });
      const service = new PetsService(prisma, buildResolver());
      const dto = {
        species: "DOG",
        name: "Fido",
        birthDate: "2020-01-01T00:00:00.000Z",
        ageEstimateMonths: 6,
      } as CreatePetDto;

      await expect(service.create(householdId, userId, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it("birthDate alone → 201-worthy create (no throw)", async () => {
      const row = buildPetRow({ birthDate: new Date("2020-01-01T00:00:00.000Z") });
      const create = jest.fn().mockResolvedValue(row);
      const prisma = buildPrisma({ create });
      const service = new PetsService(prisma, buildResolver());
      const dto = { species: "DOG", name: "Fido", birthDate: "2020-01-01T00:00:00.000Z" } as CreatePetDto;

      await expect(service.create(householdId, userId, dto)).resolves.toBeDefined();
    });

    it("ageEstimateMonths alone → no throw", async () => {
      const row = buildPetRow({ ageEstimateMonths: 6 });
      const create = jest.fn().mockResolvedValue(row);
      const prisma = buildPrisma({ create });
      const service = new PetsService(prisma, buildResolver());
      const dto = { species: "DOG", name: "Fido", ageEstimateMonths: 6 } as CreatePetDto;

      await expect(service.create(householdId, userId, dto)).resolves.toBeDefined();
    });

    it("neither set → no throw", async () => {
      const row = buildPetRow();
      const create = jest.fn().mockResolvedValue(row);
      const prisma = buildPrisma({ create });
      const service = new PetsService(prisma, buildResolver());
      const dto = { species: "DOG", name: "Fido" } as CreatePetDto;

      await expect(service.create(householdId, userId, dto)).resolves.toBeDefined();
    });

    it("FREE + existing count 0 → creates (resolver + count consulted, no throw)", async () => {
      const row = buildPetRow();
      const create = jest.fn().mockResolvedValue(row);
      const count = jest.fn().mockResolvedValue(0);
      const prisma = buildPrisma({ create, count });
      const resolver = buildResolver("FREE");
      const service = new PetsService(prisma, resolver);
      const dto = { species: "DOG", name: "Fido" } as CreatePetDto;

      await expect(service.create(householdId, userId, dto)).resolves.toBeDefined();
      expect(resolver.resolve).toHaveBeenCalledWith(userId, householdId);
      expect(count).toHaveBeenCalledWith({ where: { householdId, deletedAt: null } });
      expect(create).toHaveBeenCalled();
    });

    it("FREE + count ≥ FREE_MAX_PETS (1) → 402 HttpException, no pet.create call", async () => {
      const create = jest.fn();
      const count = jest.fn().mockResolvedValue(1);
      const prisma = buildPrisma({ create, count });
      const service = new PetsService(prisma, buildResolver("FREE"));
      const dto = { species: "DOG", name: "Fido" } as CreatePetDto;

      await expect(service.create(householdId, userId, dto)).rejects.toBeInstanceOf(HttpException);
      expect(create).not.toHaveBeenCalled();
    });

    it("PREMIUM + count ≥ 1 → creates (no gate applied)", async () => {
      const row = buildPetRow();
      const create = jest.fn().mockResolvedValue(row);
      const count = jest.fn().mockResolvedValue(3);
      const prisma = buildPrisma({ create, count });
      const service = new PetsService(prisma, buildResolver("PREMIUM"));
      const dto = { species: "DOG", name: "Fido" } as CreatePetDto;

      await expect(service.create(householdId, userId, dto)).resolves.toBeDefined();
      expect(create).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("scopes to { householdId, deletedAt: null }, ordered createdAt desc", async () => {
      const findMany = jest.fn().mockResolvedValue([buildPetRow()]);
      const prisma = buildPrisma({ findMany });
      const service = new PetsService(prisma, buildResolver());

      const result = await service.findAll(householdId);

      expect(findMany).toHaveBeenCalledWith({
        where: { householdId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
    });

    it("a soft-deleted row is absent because the where clause excludes it (findMany mock proves the filter, not app-level filtering)", async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = buildPrisma({ findMany });
      const service = new PetsService(prisma, buildResolver());

      const result = await service.findAll(householdId);

      expect(result).toEqual([]);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { householdId, deletedAt: null } }),
      );
    });
  });

  describe("findOne", () => {
    it("scopes to { id, householdId, deletedAt: null }", async () => {
      const row = buildPetRow();
      const findFirst = jest.fn().mockResolvedValue(row);
      const prisma = buildPrisma({ findFirst });
      const service = new PetsService(prisma, buildResolver());

      const result = await service.findOne(householdId, id);

      expect(findFirst).toHaveBeenCalledWith({ where: { id, householdId, deletedAt: null } });
      expect(result.id).toBe(id);
    });

    it("not found (wrong household or missing) → NotFoundException", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const prisma = buildPrisma({ findFirst });
      const service = new PetsService(prisma, buildResolver());

      await expect(service.findOne("other-household", id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("update", () => {
    it("not found (wrong household) → NotFoundException, no update call", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const update = jest.fn();
      const prisma = buildPrisma({ findFirst, update });
      const service = new PetsService(prisma, buildResolver());

      await expect(
        service.update("other-household", id, {} as UpdatePetDto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it("existing birthDate + PATCH adds ageEstimateMonths (without nulling birthDate) → BadRequestException", async () => {
      const existing = buildPetRow({ birthDate: new Date("2020-01-01T00:00:00.000Z") });
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn();
      const prisma = buildPrisma({ findFirst, update });
      const service = new PetsService(prisma, buildResolver());

      await expect(
        service.update(householdId, id, { ageEstimateMonths: 6 } as UpdatePetDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it("existing birthDate + PATCH sets ageEstimateMonths AND birthDate: null in one body → merges, no throw, writes both fields", async () => {
      const existing = buildPetRow({ birthDate: new Date("2020-01-01T00:00:00.000Z") });
      const findFirst = jest.fn().mockResolvedValue(existing);
      const updated = buildPetRow({ ageEstimateMonths: 6, birthDate: null });
      const update = jest.fn().mockResolvedValue(updated);
      const prisma = buildPrisma({ findFirst, update });
      const service = new PetsService(prisma, buildResolver());

      const dto = { ageEstimateMonths: 6, birthDate: null } as UpdatePetDto;
      const result = await service.update(householdId, id, dto);

      expect(update).toHaveBeenCalledWith({
        where: { id },
        data: { birthDate: null, ageEstimateMonths: 6 },
      });
      expect(result.ageEstimateMonths).toBe(6);
    });

    it("omitting a field preserves the existing value (does not clear it)", async () => {
      const existing = buildPetRow({ name: "Fido", breedSlug: "labrador" });
      const findFirst = jest.fn().mockResolvedValue(existing);
      const update = jest.fn().mockResolvedValue(existing);
      const prisma = buildPrisma({ findFirst, update });
      const service = new PetsService(prisma, buildResolver());

      await service.update(householdId, id, { name: "Fido II" } as UpdatePetDto);

      expect(update).toHaveBeenCalledWith({ where: { id }, data: { name: "Fido II" } });
    });
  });

  describe("remove", () => {
    it("not found (wrong household or already deleted) → NotFoundException, no write", async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const update = jest.fn();
      const prisma = buildPrisma({ findFirst, update });
      const service = new PetsService(prisma, buildResolver());

      await expect(service.remove("other-household", id)).rejects.toBeInstanceOf(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it("writes deletedAt and returns the soft-deleted resource", async () => {
      const existing = buildPetRow();
      const findFirst = jest.fn().mockResolvedValue(existing);
      const deletedRow = buildPetRow({ deletedAt: new Date() });
      const update = jest.fn().mockResolvedValue(deletedRow);
      const prisma = buildPrisma({ findFirst, update });
      const service = new PetsService(prisma, buildResolver());

      const result = await service.remove(householdId, id);

      expect(update).toHaveBeenCalledWith({ where: { id }, data: { deletedAt: expect.any(Date) } });
      expect(result.id).toBe(id);
    });
  });
});
