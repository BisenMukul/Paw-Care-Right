import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { REFRESH_TOKEN_TTL_DAYS } from "./auth.constants";

export interface IssuedRefreshToken {
  token: string;
  familyId: string;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

type PrismaTx = Prisma.TransactionClient | PrismaService;

/**
 * Refresh-token lifecycle against Postgres. Tokens are opaque, high-entropy
 * random strings, returned to the client raw exactly once and persisted
 * only as a SHA-256 hash — see auth.constants.ts and the plan's Interfaces
 * section for the rotation/reuse/logout semantics this implements.
 */
@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, familyId?: string): Promise<IssuedRefreshToken> {
    return this.issueWith(this.prisma, userId, familyId);
  }

  async rotate(presentedToken: string): Promise<RotatedRefreshToken> {
    const tokenHash = this.hash(presentedToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!row) {
      throw new UnauthorizedException();
    }

    if (row.revokedAt !== null || row.rotatedAt !== null) {
      // Reuse of an already-rotated or revoked token is a theft signal:
      // revoke the entire family, not just this token. This MUST run outside
      // a transaction that subsequently throws — an exception inside
      // $transaction would roll the revocation back and defeat the defense.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException();
    }

    if (row.expiresAt.getTime() <= Date.now()) {
      // Natural expiry — 401, but do NOT treat as theft.
      throw new UnauthorizedException();
    }

    return this.prisma.$transaction(async (tx) => {
      // Conditional update guards against a concurrent rotation of the same
      // token: only one caller wins the rotatedAt write; the loser 401s.
      const rotated = await tx.refreshToken.updateMany({
        where: { id: row.id, rotatedAt: null, revokedAt: null },
        data: { rotatedAt: new Date() },
      });

      if (rotated.count === 0) {
        throw new UnauthorizedException();
      }

      const issued = await this.issueWith(tx, row.userId, row.familyId);

      return { ...issued, userId: row.userId };
    });
  }

  async revokeFamily(presentedToken: string): Promise<void> {
    const tokenHash = this.hash(presentedToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!row) {
      // Unknown token on logout is a no-op — never probe token validity.
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueWith(
    client: PrismaTx,
    userId: string,
    familyId?: string,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString("base64url");
    const resolvedFamilyId = familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await client.refreshToken.create({
      data: {
        userId,
        familyId: resolvedFamilyId,
        tokenHash: this.hash(token),
        expiresAt,
      },
    });

    return { token, familyId: resolvedFamilyId };
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
