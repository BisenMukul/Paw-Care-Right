import { InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthService } from "../auth.service";
import { SocialAuthService } from "./social-auth.service";
import type { SocialTokenVerifier, VerifiedSocialIdentity } from "./social-verifier";

describe("SocialAuthService", () => {
  function buildAppleIdentity(overrides: Partial<VerifiedSocialIdentity> = {}): VerifiedSocialIdentity {
    return {
      provider: "apple",
      subject: "apple-sub-1",
      email: "owner@example.com",
      emailVerified: true,
      ...overrides,
    };
  }

  function buildService(options: {
    identity?: VerifiedSocialIdentity;
    findFirstBySub?: jest.Mock;
    findUniqueByEmail?: jest.Mock;
    update?: jest.Mock;
    householdFindFirst?: jest.Mock;
    provisionNewAccount?: jest.Mock;
    issueSession?: jest.Mock;
    transactionImpl?: jest.Mock;
    topLevelUserFindFirst?: jest.Mock;
    verifiers?: SocialTokenVerifier[];
  }) {
    const identity = options.identity ?? buildAppleIdentity();

    const verify = jest.fn().mockResolvedValue(identity);
    const appleVerifier: SocialTokenVerifier = { provider: "apple", verify };
    const verifiers = options.verifiers ?? [appleVerifier];

    // Shared across the tx-scoped and top-level (post-P2002 re-fetch) code
    // paths — `resolveProvisioned` is called with either `tx` or `prisma`.
    const householdFindFirst = options.householdFindFirst ?? jest.fn().mockResolvedValue({ id: "household-1" });

    const txUser = {
      findFirst: options.findFirstBySub ?? jest.fn().mockResolvedValue(null),
      findUnique: options.findUniqueByEmail ?? jest.fn().mockResolvedValue(null),
      update: options.update ?? jest.fn(),
    };
    const txHousehold = { findFirst: householdFindFirst };

    const transaction =
      options.transactionImpl ??
      jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ user: txUser, household: txHousehold }),
      );

    const prisma = {
      user: { findFirst: options.topLevelUserFindFirst ?? jest.fn().mockResolvedValue(null) },
      household: { findFirst: householdFindFirst },
      $transaction: transaction,
    } as unknown as PrismaService;

    const authService = {
      provisionNewAccount:
        options.provisionNewAccount ??
        jest.fn().mockResolvedValue({
          userId: "new-user",
          email: "owner@example.com",
          householdId: "household-new",
        }),
      issueSession:
        options.issueSession ??
        jest.fn().mockResolvedValue({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: { id: "user-1", email: "owner@example.com" },
          householdId: "household-1",
        }),
    } as unknown as AuthService;

    const service = new SocialAuthService(verifiers, authService, prisma);

    return { service, verify, txUser, txHousehold, prisma, authService };
  }

  it("found by appleSub returns the session without creating a user or household", async () => {
    const existingUser = { id: "user-1", email: "owner@example.com" };
    const { service, txUser, authService } = buildService({
      findFirstBySub: jest.fn().mockResolvedValue(existingUser),
    });

    const result = await service.login("apple", "token");

    expect(txUser.update).not.toHaveBeenCalled();
    expect(authService.provisionNewAccount).not.toHaveBeenCalled();
    expect(authService.issueSession).toHaveBeenCalledWith({
      userId: "user-1",
      email: "owner@example.com",
      householdId: "household-1",
    });
    expect(result).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user: { id: "user-1", email: "owner@example.com" },
      householdId: "household-1",
    });
  });

  it("verified-email match with no sub links by updating appleSub, without creating a user", async () => {
    const existingUser = { id: "user-2", email: "owner@example.com" };
    const { service, txUser, authService } = buildService({
      findFirstBySub: jest.fn().mockResolvedValue(null),
      findUniqueByEmail: jest.fn().mockResolvedValue(existingUser),
      update: jest.fn().mockResolvedValue({ id: "user-2", email: "owner@example.com" }),
    });

    await service.login("apple", "token");

    expect(txUser.update).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { appleSub: "apple-sub-1" },
    });
    expect(authService.provisionNewAccount).not.toHaveBeenCalled();
    expect(authService.issueSession).toHaveBeenCalledWith({
      userId: "user-2",
      email: "owner@example.com",
      householdId: "household-1",
    });
  });

  it("no sub match and no existing email match provisions a new account via AuthService", async () => {
    const { service, authService } = buildService({
      findFirstBySub: jest.fn().mockResolvedValue(null),
      findUniqueByEmail: jest.fn().mockResolvedValue(null),
    });

    const result = await service.login("apple", "token");

    expect(authService.provisionNewAccount).toHaveBeenCalledWith(expect.anything(), {
      email: "owner@example.com",
      appleSub: "apple-sub-1",
    });
    expect(result.accessToken).toBe("access-token");
  });

  it("no verified email and no sub match throws UnauthorizedException", async () => {
    const { service, authService } = buildService({
      identity: buildAppleIdentity({ email: null, emailVerified: false }),
      findFirstBySub: jest.fn().mockResolvedValue(null),
    });

    await expect(service.login("apple", "token")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.provisionNewAccount).not.toHaveBeenCalled();
    expect(authService.issueSession).not.toHaveBeenCalled();
  });

  it("re-fetches by sub on a P2002 race and returns that user's session", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    const raceUser = { id: "user-3", email: "owner@example.com" };

    const { service, authService, prisma } = buildService({
      findFirstBySub: jest.fn().mockResolvedValue(null),
      findUniqueByEmail: jest.fn().mockResolvedValue(null),
      transactionImpl: jest.fn().mockRejectedValue(p2002),
      topLevelUserFindFirst: jest.fn().mockResolvedValue(raceUser),
    });

    const result = await service.login("apple", "token");

    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { appleSub: "apple-sub-1" } });
    expect(authService.issueSession).toHaveBeenCalledWith({
      userId: "user-3",
      email: "owner@example.com",
      householdId: "household-1",
    });
    expect(result.accessToken).toBe("access-token");
  });

  it("rethrows a transaction error that is not a unique-constraint violation", async () => {
    const { service } = buildService({
      transactionImpl: jest.fn().mockRejectedValue(new Error("boom")),
    });

    await expect(service.login("apple", "token")).rejects.toThrow("boom");
  });

  it("unresolved provider throws UnauthorizedException without verifying a token", async () => {
    const { service, verify } = buildService({});

    await expect(service.login("google", "token")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it("throws InternalServerErrorException when a resolved user has no owned household", async () => {
    const existingUser = { id: "user-1", email: "owner@example.com" };
    const { service } = buildService({
      findFirstBySub: jest.fn().mockResolvedValue(existingUser),
      householdFindFirst: jest.fn().mockResolvedValue(null),
    });

    await expect(service.login("apple", "token")).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
