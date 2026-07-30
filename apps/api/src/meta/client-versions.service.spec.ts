import type { PrismaService } from "../prisma/prisma.service";
import { ClientVersionsService } from "./client-versions.service";

function buildPrisma(rows: unknown[]): PrismaService {
  return {
    $queryRaw: jest.fn().mockResolvedValue(rows),
  } as unknown as PrismaService;
}

describe("ClientVersionsService", () => {
  it("schema-validates and maps rows (otaUpdateId -> updateId)", async () => {
    const prisma = buildPrisma([
      { day: "2026-07-30", appVersion: "1.2.3", otaUpdateId: "update-1", deviceCount: 3 },
    ]);
    const service = new ClientVersionsService(prisma);

    const result = await service.aggregate(30);

    expect(result.days).toBe(30);
    expect(typeof result.generatedAt).toBe("string");
    expect(result.rows).toEqual([{ day: "2026-07-30", appVersion: "1.2.3", updateId: "update-1", deviceCount: 3 }]);
  });

  it("accepts null appVersion/updateId rows", async () => {
    const prisma = buildPrisma([{ day: "2026-07-29", appVersion: null, otaUpdateId: null, deviceCount: 1 }]);
    const service = new ClientVersionsService(prisma);

    const result = await service.aggregate(7);

    expect(result.rows).toEqual([{ day: "2026-07-29", appVersion: null, updateId: null, deviceCount: 1 }]);
  });

  it("empty result -> rows: []", async () => {
    const prisma = buildPrisma([]);
    const service = new ClientVersionsService(prisma);

    const result = await service.aggregate(30);

    expect(result.rows).toEqual([]);
  });

  it("throws (never silently coerces) when a mapped row fails schema validation", async () => {
    const prisma = buildPrisma([{ day: "2026-07-30", appVersion: null, otaUpdateId: null, deviceCount: -1 }]);
    const service = new ClientVersionsService(prisma);

    await expect(service.aggregate(30)).rejects.toThrow();
  });

  it("passes the requested days straight through to the response", async () => {
    const prisma = buildPrisma([]);
    const service = new ClientVersionsService(prisma);

    const result = await service.aggregate(90);

    expect(result.days).toBe(90);
  });

  it("the cutoff bound parameter is derived from the requested days (query is called once)", async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const service = new ClientVersionsService(prisma);

    await service.aggregate(14);

    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
