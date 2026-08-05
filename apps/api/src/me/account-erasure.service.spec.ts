import type { PrismaService } from "../prisma/prisma.service";
import type { RedisService } from "../redis/redis.service";
import type { StorageService } from "../storage/storage.service";
import { AccountErasureService } from "./account-erasure.service";

interface Recorder {
  order: string[];
}

function buildPrisma(recorder: Recorder, overrides: Record<string, unknown> = {}): PrismaService {
  const tx = {
    chatThread: {
      deleteMany: jest.fn((args) => {
        recorder.order.push("chatThread.deleteMany");
        return Promise.resolve({ count: args.where.id.in.length });
      }),
    },
    symptomCheck: {
      deleteMany: jest.fn((args) => {
        recorder.order.push("symptomCheck.deleteMany");
        return Promise.resolve({ count: args.where.id.in.length });
      }),
    },
    household: {
      delete: jest.fn(() => {
        recorder.order.push("household.delete");
        return Promise.resolve({});
      }),
    },
    membership: {
      deleteMany: jest.fn(() => {
        recorder.order.push("membership.deleteMany");
        return Promise.resolve({ count: 1 });
      }),
    },
    user: {
      delete: jest.fn(() => {
        recorder.order.push("user.delete");
        return Promise.resolve({});
      }),
    },
  };

  const base = {
    membership: {
      findFirst: jest.fn().mockResolvedValue({ userId: "user-1", householdId: "household-1", role: "OWNER" }),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: tx.membership.deleteMany,
    },
    pet: {
      findMany: jest.fn().mockResolvedValue([{ id: "pet-1" }]),
    },
    symptomCheck: {
      findMany: jest.fn().mockResolvedValue([{ id: "check-1", photoKeys: [] }]),
      deleteMany: tx.symptomCheck.deleteMany,
    },
    chatThread: {
      findMany: jest.fn().mockResolvedValue([{ id: "thread-1" }]),
      deleteMany: tx.chatThread.deleteMany,
    },
    healthLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    aiAuditLog: {
      deleteMany: jest.fn((args) => {
        recorder.order.push(args.where.checkId ? "aiAuditLog.deleteMany(checkId)" : "aiAuditLog.deleteMany(threadId)");
        return Promise.resolve({ count: 1 });
      }),
    },
    household: { delete: tx.household.delete },
    user: { delete: tx.user.delete },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    ...overrides,
  };

  return base as unknown as PrismaService;
}

function buildStorage(overrides: Partial<{ listKeys: jest.Mock; deleteObjects: jest.Mock }> = {}): StorageService {
  return {
    listKeys: overrides.listKeys ?? jest.fn().mockResolvedValue([]),
    deleteObjects: overrides.deleteObjects ?? jest.fn().mockResolvedValue(undefined),
  } as unknown as StorageService;
}

function buildRedis(): RedisService {
  return { del: jest.fn().mockResolvedValue(0) } as unknown as RedisService;
}

describe("AccountErasureService", () => {
  describe("erase() table-set + ordering (FULL_HOUSEHOLD)", () => {
    it("deletes AiAuditLog rows (by checkId AND threadId) before ChatThread/SymptomCheck, and Household before User", async () => {
      const recorder: Recorder = { order: [] };
      const prisma = buildPrisma(recorder);
      const storage = buildStorage();
      const service = new AccountErasureService(prisma, storage, buildRedis());

      const report = await service.erase("user-1");

      expect(report.mode).toBe("FULL_HOUSEHOLD");
      expect(report.deletedChecks).toBe(1);
      expect(report.deletedThreads).toBe(1);
      expect(report.deletedAuditLogs).toBe(2);

      const auditCheckIdx = recorder.order.indexOf("aiAuditLog.deleteMany(checkId)");
      const auditThreadIdx = recorder.order.indexOf("aiAuditLog.deleteMany(threadId)");
      const threadIdx = recorder.order.indexOf("chatThread.deleteMany");
      const checkIdx = recorder.order.indexOf("symptomCheck.deleteMany");
      const householdIdx = recorder.order.indexOf("household.delete");
      const userIdx = recorder.order.indexOf("user.delete");

      expect(auditCheckIdx).toBeGreaterThanOrEqual(0);
      expect(auditThreadIdx).toBeGreaterThanOrEqual(0);
      // D3: audit rows collected/deleted before the checks/threads they reference disappear.
      expect(auditCheckIdx).toBeLessThan(checkIdx);
      expect(auditThreadIdx).toBeLessThan(threadIdx);
      // Household.owner is onDelete:Restrict -- household must precede user.
      expect(householdIdx).toBeLessThan(userIdx);
      // ChatMessage/TriageResult/CheckFollowUp cascades happen before the household cascade removes pets.
      expect(threadIdx).toBeLessThan(householdIdx);
      expect(checkIdx).toBeLessThan(householdIdx);
    });

    it("lists and deletes S3 keys under every pet's prefix plus the export and feedback prefixes (T104)", async () => {
      const recorder: Recorder = { order: [] };
      const listKeys = jest.fn().mockResolvedValue(["k1", "k2"]);
      const deleteObjects = jest.fn().mockResolvedValue(undefined);
      const prisma = buildPrisma(recorder);
      const storage = buildStorage({ listKeys, deleteObjects });
      const service = new AccountErasureService(prisma, storage, buildRedis());

      const report = await service.erase("user-1");

      expect(listKeys).toHaveBeenCalledWith("pets/pet-1/");
      expect(listKeys).toHaveBeenCalledWith("exports/user-1/");
      expect(listKeys).toHaveBeenCalledWith("feedback/user-1/");
      expect(deleteObjects).toHaveBeenCalledWith(["k1", "k2", "k1", "k2", "k1", "k2"]);
      expect(report.deletedS3Keys).toBe(6);
    });

    it("throws (dead-letters) when reached with an OWNER who still has live co-members", async () => {
      const recorder: Recorder = { order: [] };
      const prisma = buildPrisma(recorder, {
        membership: {
          findFirst: jest.fn().mockResolvedValue({ userId: "user-1", householdId: "household-1", role: "OWNER" }),
          count: jest.fn().mockResolvedValue(1),
          deleteMany: jest.fn(),
        },
      });
      const service = new AccountErasureService(prisma, buildStorage(), buildRedis());

      await expect(service.erase("user-1")).rejects.toThrow(/live co-member/);
    });
  });

  describe("erase() USER_ONLY case (D1a)", () => {
    function buildMemberPrisma(recorder: Recorder, overrides: Record<string, unknown> = {}): PrismaService {
      return buildPrisma(recorder, {
        membership: {
          findFirst: jest.fn().mockResolvedValue({ userId: "member-1", householdId: "household-1", role: "MEMBER" }),
          count: jest.fn().mockResolvedValue(1),
          deleteMany: jest.fn(() => {
            recorder.order.push("membership.deleteMany");
            return Promise.resolve({ count: 1 });
          }),
        },
        ...overrides,
      });
    }

    it("deletes only the member's own checks/threads and never household/pet/user cascades", async () => {
      const recorder: Recorder = { order: [] };
      const prisma = buildMemberPrisma(recorder, {
        symptomCheck: {
          findMany: jest.fn().mockResolvedValue([{ id: "check-m1", photoKeys: [] }]),
          deleteMany: jest.fn((args) => {
            recorder.order.push("symptomCheck.deleteMany");
            return Promise.resolve({ count: args.where.id.in.length });
          }),
        },
        chatThread: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(() => {
            recorder.order.push("chatThread.deleteMany");
            return Promise.resolve({ count: 0 });
          }),
        },
        pet: { findMany: jest.fn().mockResolvedValue([{ id: "pet-1", photoKey: null }]) },
        healthLog: { findMany: jest.fn().mockResolvedValue([]) },
      });
      const service = new AccountErasureService(prisma, buildStorage(), buildRedis());

      const report = await service.erase("member-1");

      expect(report.mode).toBe("USER_ONLY");
      expect(recorder.order).toContain("membership.deleteMany");
      expect(recorder.order).not.toContain("household.delete");
    });

    it("lists and deletes S3 keys under the export and feedback prefixes too (T104)", async () => {
      const recorder: Recorder = { order: [] };
      const listKeys = jest.fn().mockResolvedValue([]);
      const deleteObjects = jest.fn().mockResolvedValue(undefined);
      const prisma = buildMemberPrisma(recorder, {
        symptomCheck: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
        },
        chatThread: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
        },
        pet: { findMany: jest.fn().mockResolvedValue([{ id: "pet-1", photoKey: null }]) },
        healthLog: { findMany: jest.fn().mockResolvedValue([]) },
      });
      const storage = buildStorage({ listKeys, deleteObjects });
      const service = new AccountErasureService(prisma, storage, buildRedis());

      await service.erase("member-1");

      expect(listKeys).toHaveBeenCalledWith("exports/member-1/");
      expect(listKeys).toHaveBeenCalledWith("feedback/member-1/");
    });

    it("never deletes a photo key still referenced by a surviving Pet.photoKey", async () => {
      const recorder: Recorder = { order: [] };
      const listKeys = jest.fn().mockResolvedValue([]);
      const deleteObjects = jest.fn().mockResolvedValue(undefined);
      const sharedOriginalKey = "pets/pet-1/original/shared.jpg";
      const ownOnlyKey = "pets/pet-1/original/own-only.jpg";

      const prisma = buildMemberPrisma(recorder, {
        symptomCheck: {
          // Discriminates on `where.createdById` -- the member's OWN checks
          // query (`createdById: "member-1"`) vs. the surviving-reference
          // "otherChecks" query (`createdById: { not: "member-1" } }`) must
          // NOT return the same rows, or the shared-key computation can't
          // be exercised (this member's own key would spuriously look
          // "referenced by another check").
          findMany: jest.fn((args: { where: { createdById: unknown } }) => {
            if (args.where.createdById === "member-1") {
              return Promise.resolve([{ id: "check-m1", photoKeys: [sharedOriginalKey, ownOnlyKey] }]);
            }
            return Promise.resolve([]);
          }),
          deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
        },
        chatThread: {
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
        },
        // Pet.photoKey stores the derived MAIN key -- matches deriveMainKey(sharedOriginalKey).
        pet: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: "pet-1", photoKey: "pets/pet-1/main/shared.jpg" }]),
        },
        healthLog: { findMany: jest.fn().mockResolvedValue([]) },
      });
      const storage = buildStorage({ listKeys, deleteObjects });
      const service = new AccountErasureService(prisma, storage, buildRedis());

      await service.erase("member-1");

      expect(deleteObjects).toHaveBeenCalledTimes(1);
      const deletedKeys = deleteObjects.mock.calls[0]![0] as string[];
      expect(deletedKeys).not.toContain(sharedOriginalKey);
      expect(deletedKeys).not.toContain("pets/pet-1/main/shared.jpg");
      expect(deletedKeys).not.toContain("pets/pet-1/thumb/shared.jpg");
      expect(deletedKeys).toContain(ownOnlyKey);
      expect(deletedKeys).toContain("pets/pet-1/main/own-only.jpg");
      expect(deletedKeys).toContain("pets/pet-1/thumb/own-only.jpg");
    });
  });

  describe("idempotency", () => {
    it("a second run on an already-erased user (no Membership row) is a no-op returning zero counts", async () => {
      const recorder: Recorder = { order: [] };
      const prisma = buildPrisma(recorder, {
        membership: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn(), deleteMany: jest.fn() },
      });
      const service = new AccountErasureService(prisma, buildStorage(), buildRedis());

      const report = await service.erase("user-1");

      expect(report).toEqual({
        mode: "NONE",
        deletedChecks: 0,
        deletedThreads: 0,
        deletedAuditLogs: 0,
        deletedS3Keys: 0,
      });
    });
  });
});
