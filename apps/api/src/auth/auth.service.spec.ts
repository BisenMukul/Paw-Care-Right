import { InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";

import type { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import type { OtpTransport } from "./otp-transport";
import type { OtpService } from "./otp.service";
import type { RefreshTokenService } from "./refresh-token.service";

describe("AuthService", () => {
  function buildService(options: {
    verifyCode?: jest.Mock;
    generateAndStore?: jest.Mock;
    issue?: jest.Mock;
    rotate?: jest.Mock;
    revokeFamily?: jest.Mock;
    sign?: jest.Mock;
    user?: { id: string; email: string } | null;
    household?: { id: string; ownerId: string; createdAt: Date } | null;
    txUser?: unknown;
  }) {
    const otpService = {
      generateAndStore: options.generateAndStore ?? jest.fn().mockResolvedValue("123456"),
      verifyCode: options.verifyCode ?? jest.fn().mockResolvedValue(true),
    } as unknown as OtpService;

    const refreshTokenService = {
      issue: options.issue ?? jest.fn().mockResolvedValue({ token: "refresh-token", familyId: "family-1" }),
      rotate:
        options.rotate ??
        jest.fn().mockResolvedValue({ token: "new-refresh-token", userId: "user-1", familyId: "family-1" }),
      revokeFamily: options.revokeFamily ?? jest.fn().mockResolvedValue(undefined),
    } as unknown as RefreshTokenService;

    const jwtService = {
      sign: options.sign ?? jest.fn().mockReturnValue("signed-access-token"),
    } as unknown as JwtService;

    const defaultUser = { id: "user-1", email: "user@example.com" };
    const userValue = "user" in options ? options.user : defaultUser;
    const userFindUnique = jest.fn().mockResolvedValue(userValue);

    const defaultHousehold = { id: "household-1", ownerId: "user-1", createdAt: new Date() };
    const householdValue = "household" in options ? options.household : defaultHousehold;
    const householdFindFirst = jest.fn().mockResolvedValue(householdValue);

    const txUser = {
      findUnique: jest.fn(),
      create: jest.fn(),
    };
    const txHousehold = { findFirst: jest.fn(), create: jest.fn() };
    const txMembership = { create: jest.fn() };

    const prisma = {
      user: { findUnique: userFindUnique },
      household: { findFirst: householdFindFirst },
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ user: txUser, household: txHousehold, membership: txMembership }),
      ),
    } as unknown as PrismaService;

    const otpTransport = { sendOtp: jest.fn().mockResolvedValue(undefined) } as unknown as OtpTransport;

    const service = new AuthService(otpService, refreshTokenService, jwtService, prisma, otpTransport);

    return { service, otpService, refreshTokenService, jwtService, prisma, otpTransport, txUser, txHousehold, txMembership };
  }

  describe("requestOtp", () => {
    it("generates and sends a code, always resolving ok:true", async () => {
      const { service, otpService, otpTransport } = buildService({});

      const result = await service.requestOtp("user@example.com");

      expect(result).toEqual({ ok: true });
      expect(otpService.generateAndStore).toHaveBeenCalledWith("user@example.com");
      expect(otpTransport.sendOtp).toHaveBeenCalledWith("user@example.com", "123456");
    });
  });

  describe("verifyOtp", () => {
    it("throws UnauthorizedException when the code is invalid", async () => {
      const { service } = buildService({ verifyCode: jest.fn().mockResolvedValue(false) });

      await expect(service.verifyOtp("user@example.com", "000000")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("on an unknown email, creates a user + household + membership and returns tokens", async () => {
      const { service, txUser, txHousehold, txMembership, refreshTokenService } = buildService({});
      txUser.findUnique.mockResolvedValue(null);
      txUser.create.mockResolvedValue({ id: "new-user", email: "new@example.com" });
      txHousehold.create.mockResolvedValue({ id: "new-household" });

      const result = await service.verifyOtp("new@example.com", "123456");

      expect(txUser.create).toHaveBeenCalledTimes(1);
      expect(txHousehold.create).toHaveBeenCalledTimes(1);
      expect(txMembership.create).toHaveBeenCalledWith({
        data: { userId: "new-user", householdId: "new-household", role: "OWNER" },
      });
      expect(refreshTokenService.issue).toHaveBeenCalledWith("new-user");
      expect(result).toEqual({
        accessToken: "signed-access-token",
        refreshToken: "refresh-token",
        user: { id: "new-user", email: "new@example.com" },
        householdId: "new-household",
      });
    });

    it("on a known email, does not create a household and reuses the existing one", async () => {
      const { service, txUser, txHousehold, txMembership } = buildService({});
      txUser.findUnique.mockResolvedValue({ id: "existing-user", email: "existing@example.com" });
      txHousehold.findFirst.mockResolvedValue({ id: "existing-household" });

      const result = await service.verifyOtp("existing@example.com", "123456");

      expect(txUser.create).not.toHaveBeenCalled();
      expect(txHousehold.create).not.toHaveBeenCalled();
      expect(txMembership.create).not.toHaveBeenCalled();
      expect(result.householdId).toBe("existing-household");
      expect(result.user).toEqual({ id: "existing-user", email: "existing@example.com" });
    });

    it("throws InternalServerErrorException when a known user has no owned household", async () => {
      const { service, txUser, txHousehold } = buildService({});
      txUser.findUnique.mockResolvedValue({ id: "existing-user", email: "existing@example.com" });
      txHousehold.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp("existing@example.com", "123456")).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe("refresh", () => {
    it("delegates to refreshTokenService.rotate and returns the shaped token pair", async () => {
      const { service, refreshTokenService } = buildService({});

      const result = await service.refresh("old-refresh-token");

      expect(refreshTokenService.rotate).toHaveBeenCalledWith("old-refresh-token");
      expect(result).toEqual({
        accessToken: "signed-access-token",
        refreshToken: "new-refresh-token",
        user: { id: "user-1", email: "user@example.com" },
        householdId: "household-1",
      });
    });

    it("throws UnauthorizedException when the rotated userId has no user record", async () => {
      const { service } = buildService({ user: null });

      await expect(service.refresh("old-refresh-token")).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws InternalServerErrorException when the user has no owned household", async () => {
      const { service } = buildService({ household: null });

      await expect(service.refresh("old-refresh-token")).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe("logout", () => {
    it("delegates to refreshTokenService.revokeFamily and always returns ok:true", async () => {
      const { service, refreshTokenService } = buildService({});

      const result = await service.logout("some-refresh-token");

      expect(refreshTokenService.revokeFamily).toHaveBeenCalledWith("some-refresh-token");
      expect(result).toEqual({ ok: true });
    });
  });
});
