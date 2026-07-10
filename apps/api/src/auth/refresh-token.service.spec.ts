import { createHash } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";

import type { PrismaService } from "../prisma/prisma.service";
import { REFRESH_TOKEN_TTL_DAYS } from "./auth.constants";
import { RefreshTokenService } from "./refresh-token.service";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

describe("RefreshTokenService", () => {
  function buildService(overrides: {
    findUnique?: jest.Mock;
    create?: jest.Mock;
    update?: jest.Mock;
    updateMany?: jest.Mock;
  }) {
    const refreshToken = {
      findUnique: overrides.findUnique ?? jest.fn(),
      create: overrides.create ?? jest.fn().mockResolvedValue({}),
      update: overrides.update ?? jest.fn().mockResolvedValue({}),
      updateMany: overrides.updateMany ?? jest.fn().mockResolvedValue({ count: 0 }),
    };

    const prisma = {
      refreshToken,
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback({ refreshToken })),
    } as unknown as PrismaService;

    return { service: new RefreshTokenService(prisma), refreshToken, prisma };
  }

  it("issue creates a row with a sha256 token hash and a ~30-day expiry", async () => {
    const { service, refreshToken } = buildService({});

    const result = await service.issue("user-1");

    expect(refreshToken.create).toHaveBeenCalledTimes(1);
    const call = refreshToken.create.mock.calls[0][0] as {
      data: { userId: string; tokenHash: string; expiresAt: Date; familyId: string };
    };
    expect(call.data.userId).toBe("user-1");
    expect(call.data.tokenHash).toBe(hash(result.token));

    const expectedExpiry = Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(call.data.expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 5000);
    expect(call.data.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 5000);
    expect(result.familyId).toBe(call.data.familyId);
  });

  it("rotate on a valid row marks rotatedAt and issues a new token in the same familyId", async () => {
    const row = {
      id: "row-1",
      userId: "user-1",
      familyId: "family-1",
      revokedAt: null,
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const { service, refreshToken } = buildService({
      findUnique: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    });

    const result = await service.rotate("presented-token");

    // Conditional rotate write (race guard): only untouched rows are rotated.
    expect(refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: "row-1", rotatedAt: null, revokedAt: null },
      data: { rotatedAt: expect.any(Date) },
    });
    expect(result.userId).toBe("user-1");
    expect(result.familyId).toBe("family-1");
    expect(refreshToken.create).toHaveBeenCalledTimes(1);
    const call = refreshToken.create.mock.calls[0][0] as { data: { familyId: string } };
    expect(call.data.familyId).toBe("family-1");
  });

  it("rotate that loses a concurrent-rotation race (count 0) throws without issuing", async () => {
    const row = {
      id: "row-1",
      userId: "user-1",
      familyId: "family-1",
      revokedAt: null,
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const { service, refreshToken } = buildService({
      findUnique: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    });

    await expect(service.rotate("presented-token")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.create).not.toHaveBeenCalled();
  });

  it("rotate on an already-rotated row revokes the family and throws UnauthorizedException", async () => {
    const row = {
      id: "row-1",
      userId: "user-1",
      familyId: "family-1",
      revokedAt: null,
      rotatedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    const { service, refreshToken } = buildService({
      findUnique: jest.fn().mockResolvedValue(row),
    });

    await expect(service.rotate("presented-token")).rejects.toBeInstanceOf(UnauthorizedException);

    expect(refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: "family-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rotate on an already-revoked row revokes the family and throws UnauthorizedException", async () => {
    const row = {
      id: "row-1",
      userId: "user-1",
      familyId: "family-1",
      revokedAt: new Date(),
      rotatedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const { service, refreshToken } = buildService({
      findUnique: jest.fn().mockResolvedValue(row),
    });

    await expect(service.rotate("presented-token")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.updateMany).toHaveBeenCalledTimes(1);
  });

  it("rotate on an expired row throws UnauthorizedException without revoking the family", async () => {
    const row = {
      id: "row-1",
      userId: "user-1",
      familyId: "family-1",
      revokedAt: null,
      rotatedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    };
    const { service, refreshToken } = buildService({
      findUnique: jest.fn().mockResolvedValue(row),
    });

    await expect(service.rotate("presented-token")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
    expect(refreshToken.update).not.toHaveBeenCalled();
  });

  it("rotate on an unknown token hash throws UnauthorizedException", async () => {
    const { service } = buildService({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(service.rotate("unknown-token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("revokeFamily sets revokedAt on all non-revoked rows in the family", async () => {
    const row = { id: "row-1", userId: "user-1", familyId: "family-1" };
    const { service, refreshToken } = buildService({
      findUnique: jest.fn().mockResolvedValue(row),
    });

    await service.revokeFamily("presented-token");

    expect(refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: "family-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("revokeFamily on an unknown token is a no-op (no throw)", async () => {
    const { service, refreshToken } = buildService({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(service.revokeFamily("unknown-token")).resolves.toBeUndefined();
    expect(refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
