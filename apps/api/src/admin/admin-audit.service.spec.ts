import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";
import { AdminAuditService } from "./admin-audit.service";

function buildRow(overrides: Partial<{ id: string; createdAt: Date }> = {}) {
  return {
    id: overrides.id ?? "audit-1",
    surface: "CHECK" as const,
    checkId: "check-1",
    threadId: null,
    promptVersion: "v1",
    modelId: "model-1",
    detectorFlags: ["red_flag_hit"],
    costMicroUsd: 100,
    latencyMs: 500,
    status: "OK",
    createdAt: overrides.createdAt ?? new Date("2026-07-30T00:00:00.000Z"),
  };
}

describe("AdminAuditService", () => {
  function buildPrisma(overrides: { findMany?: jest.Mock; findUnique?: jest.Mock }): PrismaService {
    return {
      aiAuditLog: {
        findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
        // Default: any cursor "exists" -- tests that don't care about the
        // pre-check pass a cursor and expect it to reach findMany.
        findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue({ id: "some-id" }),
      },
    } as unknown as PrismaService;
  }

  it("limit+1 sentinel: when more rows exist than the requested limit, returns exactly `limit` rows and a non-null nextCursor equal to the last returned row's id", async () => {
    const rows = [buildRow({ id: "a" }), buildRow({ id: "b" }), buildRow({ id: "c" })];
    const findMany = jest.fn().mockResolvedValue(rows);
    const service = new AdminAuditService(buildPrisma({ findMany }));

    const page = await service.getPage(2, undefined);

    expect(page.rows).toHaveLength(2);
    expect(page.rows.map((row) => row.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
  });

  it("last page: when the returned rows are <= limit, nextCursor is null", async () => {
    const rows = [buildRow({ id: "a" })];
    const findMany = jest.fn().mockResolvedValue(rows);
    const service = new AdminAuditService(buildPrisma({ findMany }));

    const page = await service.getPage(50, undefined);

    expect(page.rows).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it("requests take: limit + 1, orderBy createdAt desc then id desc, and skips the cursor pre-check entirely when no cursor is given", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findUnique = jest.fn();
    const service = new AdminAuditService(buildPrisma({ findMany, findUnique }));

    await service.getPage(10, undefined);

    const call = findMany.mock.calls[0]![0] as { take: number; orderBy: unknown };
    expect(call.take).toBe(11);
    expect(call.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(call).not.toHaveProperty("cursor");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("passes cursor + skip:1 to findMany when a cursor is given and the pre-check finds it", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findUnique = jest.fn().mockResolvedValue({ id: "cursor-id-1" });
    const service = new AdminAuditService(buildPrisma({ findMany, findUnique }));

    await service.getPage(10, "cursor-id-1");

    expect(findUnique).toHaveBeenCalledWith({ where: { id: "cursor-id-1" }, select: { id: true } });
    const call = findMany.mock.calls[0]![0] as { cursor: { id: string }; skip: number };
    expect(call.cursor).toEqual({ id: "cursor-id-1" });
    expect(call.skip).toBe(1);
  });

  it("the select keys equal the pinned 11-column allowlist (codes-only, never content)", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AdminAuditService(buildPrisma({ findMany }));

    await service.getPage(10, undefined);

    const call = findMany.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(new Set(Object.keys(call.select))).toEqual(
      new Set([
        "id",
        "surface",
        "checkId",
        "threadId",
        "promptVersion",
        "modelId",
        "detectorFlags",
        "costMicroUsd",
        "latencyMs",
        "status",
        "createdAt",
      ]),
    );
  });

  it("an unknown cursor id: the pre-check finds no row -> BadRequestException (400), never a 500, never a silent empty page, and findMany is never called", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new AdminAuditService(buildPrisma({ findMany, findUnique }));

    await expect(service.getPage(10, "does-not-exist")).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("a Prisma client error surfaced by the page query itself (defensive second layer) -> BadRequestException", async () => {
    const findMany = jest
      .fn()
      .mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("record to cursor on not found", {
          code: "P2025",
          clientVersion: "test",
        }),
      );
    const service = new AdminAuditService(buildPrisma({ findMany }));

    await expect(service.getPage(10, undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("a non-Prisma error is rethrown as-is (never swallowed into a 400)", async () => {
    const findMany = jest.fn().mockRejectedValue(new Error("infra outage"));
    const service = new AdminAuditService(buildPrisma({ findMany }));

    await expect(service.getPage(10, undefined)).rejects.toThrow("infra outage");
  });
});
