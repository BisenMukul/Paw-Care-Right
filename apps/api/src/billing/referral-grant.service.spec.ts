import { Prisma } from "@prisma/client";

import type { PrismaService } from "../prisma/prisma.service";
import { ReferralGrantService } from "./referral-grant.service";
import { REFERRAL_GRANT_MS } from "./referral.constants";

const NOW = new Date("2026-07-30T12:00:00.000Z");
const inviteId = "invite-1";
const joinerUserId = "joiner-1";
const inviterUserId = "inviter-1";

/**
 * FIX ROUND (F1/F2): the service now opens its OWN `$transaction` (never
 * takes a caller-supplied `tx`), so the test double is a `PrismaService`
 * whose `$transaction` immediately invokes the callback with a fake `tx`
 * exposing `$executeRaw` (the advisory-lock call site) and
 * `referralGrant.findMany`/`create`.
 */
function buildPrisma(overrides: { findMany?: jest.Mock; create?: jest.Mock; executeRaw?: jest.Mock }) {
  const tx = {
    $executeRaw: overrides.executeRaw ?? jest.fn().mockResolvedValue(1),
    referralGrant: {
      findMany: overrides.findMany ?? jest.fn().mockResolvedValue([]),
      create: overrides.create ?? jest.fn().mockResolvedValue(undefined),
    },
  };
  const transactionMock = jest.fn(async (cb: (tx: unknown) => unknown) => cb(tx));
  const prisma = { $transaction: transactionMock } as unknown as PrismaService;
  return { prisma, tx, transactionMock };
}

describe("ReferralGrantService.issueForAcceptedInvite", () => {
  it("grants both sides on a first accept", async () => {
    const { prisma, tx } = buildPrisma({});
    const service = new ReferralGrantService(prisma);

    await service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW);

    expect(tx.referralGrant.create).toHaveBeenCalledTimes(2);
    expect(tx.referralGrant.create).toHaveBeenCalledWith({
      data: {
        userId: joinerUserId,
        counterpartyUserId: inviterUserId,
        inviteId,
        startsAt: NOW,
        expiresAt: new Date(NOW.getTime() + REFERRAL_GRANT_MS),
      },
    });
    expect(tx.referralGrant.create).toHaveBeenCalledWith({
      data: {
        userId: inviterUserId,
        counterpartyUserId: joinerUserId,
        inviteId,
        startsAt: NOW,
        expiresAt: new Date(NOW.getTime() + REFERRAL_GRANT_MS),
      },
    });
  });

  it("issues both grants inside a SINGLE transaction (one $transaction call, not two)", async () => {
    const { prisma, transactionMock } = buildPrisma({});
    const service = new ReferralGrantService(prisma);

    await service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW);

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  it("F2: acquires a pg_advisory_xact_lock for BOTH recipients, in sorted (deterministic) order, before either cap check runs", async () => {
    const { prisma, tx } = buildPrisma({});
    const service = new ReferralGrantService(prisma);

    await service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW);

    const executeRawMock = tx.$executeRaw as jest.Mock;
    const findManyMock = tx.referralGrant.findMany as jest.Mock;
    expect(executeRawMock).toHaveBeenCalledTimes(2);
    // "inviter-1" < "joiner-1" lexicographically -- sorted lock order.
    expect(executeRawMock.mock.calls[0]?.[1]).toBe(inviterUserId);
    expect(executeRawMock.mock.calls[1]?.[1]).toBe(joinerUserId);
    // Both locks are acquired BEFORE either recipient's cap check (findMany)
    // runs -- ordering is asserted via jest's invocation-order counters
    // (both mocks share one global call-order sequence), not by "not called"
    // (which would be trivially true only before the awaited call, not
    // meaningful to assert afterwards).
    const lastLockCallOrder = Math.max(...executeRawMock.mock.invocationCallOrder);
    const firstFindManyCallOrder = Math.min(...findManyMock.mock.invocationCallOrder);
    expect(lastLockCallOrder).toBeLessThan(firstFindManyCallOrder);
  });

  it("chains the second grant onto the first (per-recipient existing rows extend the window)", async () => {
    const priorExpiry = new Date(NOW.getTime() + REFERRAL_GRANT_MS);
    const findMany = jest.fn().mockImplementation(({ where }: { where: { userId: string } }) => {
      if (where.userId === joinerUserId) {
        return Promise.resolve([{ startsAt: NOW, expiresAt: priorExpiry }]);
      }
      return Promise.resolve([]);
    });
    const { prisma, tx } = buildPrisma({ findMany });
    const service = new ReferralGrantService(prisma);

    await service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW);

    expect(tx.referralGrant.create).toHaveBeenCalledWith({
      data: {
        userId: joinerUserId,
        counterpartyUserId: inviterUserId,
        inviteId,
        startsAt: priorExpiry,
        expiresAt: new Date(priorExpiry.getTime() + REFERRAL_GRANT_MS),
      },
    });
  });

  it("skips a recipient already at 3 grants and still grants the other side", async () => {
    const threeGrants = [0, 1, 2].map(() => ({ startsAt: NOW, expiresAt: NOW }));
    const findMany = jest.fn().mockImplementation(({ where }: { where: { userId: string } }) => {
      if (where.userId === joinerUserId) {
        return Promise.resolve(threeGrants);
      }
      return Promise.resolve([]);
    });
    const { prisma, tx } = buildPrisma({ findMany });
    const service = new ReferralGrantService(prisma);

    await service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW);

    expect(tx.referralGrant.create).toHaveBeenCalledTimes(1);
    expect(tx.referralGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: inviterUserId }) }),
    );
  });

  it("never throws when a recipient is at cap", async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([{ startsAt: NOW, expiresAt: NOW }, { startsAt: NOW, expiresAt: NOW }, { startsAt: NOW, expiresAt: NOW }]);
    const { prisma, tx } = buildPrisma({ findMany });
    const service = new ReferralGrantService(prisma);

    await expect(service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW)).resolves.toBeUndefined();
    expect(tx.referralGrant.create).not.toHaveBeenCalled();
  });

  // FIX ROUND (F1): no fake P2002 swallow -- a collision (which the F2
  // advisory lock makes practically unreachable) PROPAGATES out of
  // `issueForAcceptedInvite`. The caller (`HouseholdsService.acceptInvite`)
  // is the one that logs and swallows it, and only AFTER its own join
  // transaction has already committed -- never a fake silent swallow here.
  // Mutation-proof pin: reintroducing a try/catch-and-return around the
  // `create` call for P2002 flips this test to a false resolve.
  it("a P2002 on insert PROPAGATES (is not swallowed here)", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const create = jest.fn().mockRejectedValue(p2002);
    const { prisma } = buildPrisma({ create });
    const service = new ReferralGrantService(prisma);

    await expect(service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW)).rejects.toThrow(
      "Unique constraint failed",
    );
  });

  it("a non-P2002 error on insert also propagates", async () => {
    const genericError = new Error("boom");
    const create = jest.fn().mockRejectedValue(genericError);
    const { prisma } = buildPrisma({ create });
    const service = new ReferralGrantService(prisma);

    await expect(service.issueForAcceptedInvite({ inviteId, joinerUserId, inviterUserId }, NOW)).rejects.toThrow(
      "boom",
    );
  });

  it("is a no-op when joiner and inviter are the same id (defensive) -- no transaction opened at all", async () => {
    const { prisma, transactionMock } = buildPrisma({});
    const service = new ReferralGrantService(prisma);

    await service.issueForAcceptedInvite({ inviteId, joinerUserId: "same-user", inviterUserId: "same-user" }, NOW);

    expect(transactionMock).not.toHaveBeenCalled();
  });
});
