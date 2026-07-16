import { ConflictException, HttpException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";
import type { EntitlementResolver } from "../quota/entitlement";
import { INVITE_CODE_REGEX } from "./invite-code";
import { HouseholdsService } from "./households.service";

describe("HouseholdsService", () => {
  const householdId = "household-1";
  const createdById = "owner-1";
  const inviteId = "invite-1";
  const code = "AB3DEFGH";

  function buildInviteRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: inviteId,
      code,
      householdId,
      createdById,
      usedById: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      usedAt: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      ...overrides,
    };
  }

  function buildPrisma(overrides: {
    householdInvite?: Partial<{ create: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock }>;
    membership?: Partial<{ findMany: jest.Mock; delete: jest.Mock; create: jest.Mock }>;
    pet?: Partial<{ count: jest.Mock }>;
    household?: Partial<{ delete: jest.Mock; findUnique: jest.Mock; create: jest.Mock }>;
    transaction?: jest.Mock;
  }) {
    return {
      householdInvite: {
        create: overrides.householdInvite?.create ?? jest.fn(),
        findUnique: overrides.householdInvite?.findUnique ?? jest.fn(),
        updateMany: overrides.householdInvite?.updateMany ?? jest.fn(),
      },
      membership: {
        findMany: overrides.membership?.findMany ?? jest.fn(),
        delete: overrides.membership?.delete ?? jest.fn(),
        create: overrides.membership?.create ?? jest.fn(),
      },
      pet: {
        count: overrides.pet?.count ?? jest.fn(),
      },
      household: {
        delete: overrides.household?.delete ?? jest.fn(),
        findUnique: overrides.household?.findUnique ?? jest.fn(),
        create: overrides.household?.create ?? jest.fn(),
      },
      $transaction: overrides.transaction ?? jest.fn(async (cb: (tx: unknown) => unknown) => cb(undefined)),
    } as unknown as PrismaService;
  }

  /** Defaults to PREMIUM so the pre-existing `createInvite` mint-flow tests
   *  (which predate the T075 gate) are unaffected by it; `acceptInvite`/
   *  `getHouseholdMe` never consult the resolver at all. */
  function buildResolver(tier: "FREE" | "PREMIUM" = "PREMIUM"): EntitlementResolver {
    return { resolve: jest.fn().mockResolvedValue({ tier, bypassQuota: false }) };
  }

  describe("createInvite", () => {
    it("sets expiresAt to ~7 days ahead and returns a code/deepLink matching the contract", async () => {
      const create = jest.fn().mockResolvedValue(undefined);
      const prisma = buildPrisma({ householdInvite: { create } });
      const service = new HouseholdsService(prisma, buildResolver());

      const before = Date.now();
      const result = await service.createInvite(householdId, createdById);
      const after = Date.now();

      expect(result.code).toMatch(INVITE_CODE_REGEX);
      expect(result.deepLink).toBe(`pawcareright://join/${result.code}`);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
      expect(create).toHaveBeenCalledWith({
        data: { code: result.code, householdId, createdById, expiresAt: result.expiresAt },
      });
    });

    it("retries on a P2002 code collision and succeeds", async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
      const create = jest.fn().mockRejectedValueOnce(p2002).mockResolvedValueOnce(undefined);
      const prisma = buildPrisma({ householdInvite: { create } });
      const service = new HouseholdsService(prisma, buildResolver());

      const result = await service.createInvite(householdId, createdById);

      expect(create).toHaveBeenCalledTimes(2);
      expect(result.code).toMatch(INVITE_CODE_REGEX);
    });

    it("a non-P2002 error is not retried", async () => {
      const genericError = new Error("boom");
      const create = jest.fn().mockRejectedValue(genericError);
      const prisma = buildPrisma({ householdInvite: { create } });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.createInvite(householdId, createdById)).rejects.toThrow("boom");
      expect(create).toHaveBeenCalledTimes(1);
    });

    it("FREE → 402 HttpException, no invite persisted", async () => {
      const create = jest.fn();
      const prisma = buildPrisma({ householdInvite: { create } });
      const resolver = buildResolver("FREE");
      const service = new HouseholdsService(prisma, resolver);

      await expect(service.createInvite(householdId, createdById)).rejects.toBeInstanceOf(HttpException);
      expect(resolver.resolve).toHaveBeenCalledWith(createdById, householdId);
      expect(create).not.toHaveBeenCalled();
    });

    it("PREMIUM → succeeds (mints an invite)", async () => {
      const create = jest.fn().mockResolvedValue(undefined);
      const prisma = buildPrisma({ householdInvite: { create } });
      const service = new HouseholdsService(prisma, buildResolver("PREMIUM"));

      const result = await service.createInvite(householdId, createdById);

      expect(result.code).toMatch(INVITE_CODE_REGEX);
      expect(create).toHaveBeenCalled();
    });
  });

  describe("acceptInvite", () => {
    it("invite not found → NotFoundException, no transaction", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const transaction = jest.fn();
      const prisma = buildPrisma({ householdInvite: { findUnique }, transaction });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.acceptInvite("joiner-1", code)).rejects.toBeInstanceOf(NotFoundException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("expired invite → NotFoundException, no transaction", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow({ expiresAt: new Date(Date.now() - 1000) }));
      const transaction = jest.fn();
      const prisma = buildPrisma({ householdInvite: { findUnique }, transaction });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.acceptInvite("joiner-1", code)).rejects.toBeInstanceOf(NotFoundException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("already-used invite → NotFoundException, no transaction", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow({ usedAt: new Date() }));
      const transaction = jest.fn();
      const prisma = buildPrisma({ householdInvite: { findUnique }, transaction });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.acceptInvite("joiner-1", code)).rejects.toBeInstanceOf(NotFoundException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("joiner has zero/multiple memberships → ConflictException, no transaction", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow());
      const findMany = jest.fn().mockResolvedValue([]);
      const transaction = jest.fn();
      const prisma = buildPrisma({
        householdInvite: { findUnique },
        membership: { findMany },
        transaction,
      });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.acceptInvite("joiner-1", code)).rejects.toBeInstanceOf(ConflictException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("own-household accept (sole membership already in the invite's household) → ConflictException", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow());
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: "m1", userId: "joiner-1", householdId, role: "OWNER" }]);
      const transaction = jest.fn();
      const prisma = buildPrisma({
        householdInvite: { findUnique },
        membership: { findMany },
        transaction,
      });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.acceptInvite("joiner-1", code)).rejects.toBeInstanceOf(ConflictException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("claim updateMany count 0 (lost race) → NotFoundException", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow());
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: "m1", userId: "joiner-1", householdId: "other-household", role: "OWNER" }]);
      const updateMany = jest.fn().mockResolvedValue({ count: 0 });
      const petCount = jest.fn();
      const transaction = jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          householdInvite: { updateMany },
          pet: { count: petCount },
          household: { delete: jest.fn(), findUnique: jest.fn() },
          membership: { delete: jest.fn(), create: jest.fn() },
        }),
      );
      const prisma = buildPrisma({
        householdInvite: { findUnique },
        membership: { findMany },
        transaction,
      });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.acceptInvite("joiner-1", code)).rejects.toBeInstanceOf(NotFoundException);
      expect(petCount).not.toHaveBeenCalled();
    });

    it("happy join-replaces (joiner is OWNER of an empty solo household): deletes old household, creates MEMBER row", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow());
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: "m1", userId: "joiner-1", householdId: "old-household", role: "OWNER" }]);
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const petCount = jest.fn().mockResolvedValue(0);
      const householdDelete = jest.fn().mockResolvedValue(undefined);
      const membershipCreate = jest.fn().mockResolvedValue(undefined);
      const householdFindUnique = jest.fn().mockResolvedValue({ id: householdId, name: "Target Household" });
      const transaction = jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          householdInvite: { updateMany },
          pet: { count: petCount },
          household: { delete: householdDelete, findUnique: householdFindUnique },
          membership: { delete: jest.fn(), create: membershipCreate },
        }),
      );
      const prisma = buildPrisma({
        householdInvite: { findUnique },
        membership: { findMany },
        transaction,
      });
      const service = new HouseholdsService(prisma, buildResolver());

      const result = await service.acceptInvite("joiner-1", code);

      expect(householdDelete).toHaveBeenCalledWith({ where: { id: "old-household" } });
      expect(membershipCreate).toHaveBeenCalledWith({
        data: { userId: "joiner-1", householdId, role: "MEMBER" },
      });
      expect(result).toEqual({ householdId, name: "Target Household" });
    });

    it("happy join-replaces (joiner is MEMBER elsewhere): drops only their membership row, no household delete", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow());
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: "m1", userId: "joiner-1", householdId: "old-household", role: "MEMBER" }]);
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const petCount = jest.fn().mockResolvedValue(0);
      const householdDelete = jest.fn();
      const membershipDelete = jest.fn().mockResolvedValue(undefined);
      const membershipCreate = jest.fn().mockResolvedValue(undefined);
      const householdFindUnique = jest.fn().mockResolvedValue({ id: householdId, name: "Target Household" });
      const transaction = jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          householdInvite: { updateMany },
          pet: { count: petCount },
          household: { delete: householdDelete, findUnique: householdFindUnique },
          membership: { delete: membershipDelete, create: membershipCreate },
        }),
      );
      const prisma = buildPrisma({
        householdInvite: { findUnique },
        membership: { findMany },
        transaction,
      });
      const service = new HouseholdsService(prisma, buildResolver());

      await service.acceptInvite("joiner-1", code);

      expect(householdDelete).not.toHaveBeenCalled();
      expect(membershipDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
      expect(membershipCreate).toHaveBeenCalled();
    });

    it("pets-present in the joiner's current household → ConflictException, no membership.create", async () => {
      const findUnique = jest.fn().mockResolvedValue(buildInviteRow());
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: "m1", userId: "joiner-1", householdId: "old-household", role: "OWNER" }]);
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const petCount = jest.fn().mockResolvedValue(2);
      const householdDelete = jest.fn();
      const membershipCreate = jest.fn();
      const transaction = jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          householdInvite: { updateMany },
          pet: { count: petCount },
          household: { delete: householdDelete, findUnique: jest.fn() },
          membership: { delete: jest.fn(), create: membershipCreate },
        }),
      );
      const prisma = buildPrisma({
        householdInvite: { findUnique },
        membership: { findMany },
        transaction,
      });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.acceptInvite("joiner-1", code)).rejects.toBeInstanceOf(ConflictException);
      expect(householdDelete).not.toHaveBeenCalled();
      expect(membershipCreate).not.toHaveBeenCalled();
    });
  });

  describe("leaveHousehold", () => {
    it("MEMBER leaves: creates a new solo household + OWNER membership, deletes the old membership, returns the new household", async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: "m1", userId: "joiner-1", householdId: "old-household", role: "MEMBER" }]);
      const householdCreate = jest.fn().mockResolvedValue({ id: "new-household", name: "My Household" });
      const membershipCreate = jest.fn().mockResolvedValue(undefined);
      const membershipDelete = jest.fn().mockResolvedValue(undefined);
      const transaction = jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb({
          household: { create: householdCreate },
          membership: { create: membershipCreate, delete: membershipDelete },
        }),
      );
      const prisma = buildPrisma({ membership: { findMany }, transaction });
      const service = new HouseholdsService(prisma, buildResolver());

      const result = await service.leaveHousehold("joiner-1");

      expect(householdCreate).toHaveBeenCalledWith({
        data: { name: "My Household", ownerId: "joiner-1" },
      });
      expect(membershipCreate).toHaveBeenCalledWith({
        data: { userId: "joiner-1", householdId: "new-household", role: "OWNER" },
      });
      expect(membershipDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
      expect(result).toEqual({ householdId: "new-household", name: "My Household" });
    });

    it("OWNER calling leave -> ConflictException, no transaction", async () => {
      const findMany = jest
        .fn()
        .mockResolvedValue([{ id: "m1", userId: "owner-1", householdId: "household-1", role: "OWNER" }]);
      const transaction = jest.fn();
      const prisma = buildPrisma({ membership: { findMany }, transaction });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.leaveHousehold("owner-1")).rejects.toBeInstanceOf(ConflictException);
      expect(transaction).not.toHaveBeenCalled();
    });

    it("membership count !== 1 -> ConflictException, no transaction", async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const transaction = jest.fn();
      const prisma = buildPrisma({ membership: { findMany }, transaction });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.leaveHousehold("nowhere-1")).rejects.toBeInstanceOf(ConflictException);
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe("getHouseholdMe", () => {
    it("maps memberships to { userId, email, role }", async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: householdId,
        name: "The Smiths",
        memberships: [
          { userId: "u1", role: "OWNER", user: { email: "owner@example.com" } },
          { userId: "u2", role: "MEMBER", user: { email: "member@example.com" } },
        ],
      });
      const prisma = buildPrisma({ household: { findUnique } });
      const service = new HouseholdsService(prisma, buildResolver());

      const result = await service.getHouseholdMe(householdId);

      expect(result).toEqual({
        id: householdId,
        name: "The Smiths",
        members: [
          { userId: "u1", email: "owner@example.com", role: "OWNER" },
          { userId: "u2", email: "member@example.com", role: "MEMBER" },
        ],
      });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: householdId },
        include: { memberships: { include: { user: true } } },
      });
    });

    it("household not found (defensive) → NotFoundException", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const prisma = buildPrisma({ household: { findUnique } });
      const service = new HouseholdsService(prisma, buildResolver());

      await expect(service.getHouseholdMe(householdId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
