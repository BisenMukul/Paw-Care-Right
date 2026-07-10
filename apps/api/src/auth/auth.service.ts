import { Inject, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  ACCESS_TOKEN_TTL,
  DEFAULT_HOUSEHOLD_NAME,
  DEFAULT_LOCALE,
  DEFAULT_REGION,
} from "./auth.constants";
import { OTP_TRANSPORT, type OtpTransport } from "./otp-transport";
import { OtpService } from "./otp.service";
import { RefreshTokenService } from "./refresh-token.service";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
  householdId: string;
}

export interface RequestOtpResult {
  ok: true;
}

export interface LogoutResult {
  ok: true;
}

export interface ProvisionedUser {
  userId: string;
  email: string;
  householdId: string;
}

export interface NewAccountParams {
  email: string;
  appleSub?: string;
  googleSub?: string;
}

type PrismaTx = Prisma.TransactionClient | PrismaService;

/**
 * Orchestrates the OTP + JWT + refresh-token auth flow. Owns the
 * provision-or-get-user transaction and JWT signing; delegates OTP code
 * lifecycle to OtpService and refresh-token lifecycle to
 * RefreshTokenService.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(OTP_TRANSPORT) private readonly otpTransport: OtpTransport,
  ) {}

  async requestOtp(email: string): Promise<RequestOtpResult> {
    const code = await this.otpService.generateAndStore(email);
    await this.otpTransport.sendOtp(email, code);
    return { ok: true };
  }

  async verifyOtp(email: string, code: string): Promise<AuthTokens> {
    const isValid = await this.otpService.verifyCode(email, code);

    if (!isValid) {
      // Wrong / expired / too-many-attempts / unknown are never
      // distinguished in the response — always a plain 401.
      throw new UnauthorizedException();
    }

    const provisioned = await this.provisionOrGetUser(email);
    return this.issueSession(provisioned);
  }

  /**
   * Signs an access token and issues a refresh token for an
   * already-resolved user, shaping the standard `AuthTokens` response.
   * Shared by `verifyOtp` and `SocialAuthService` so every sign-in path
   * (OTP, Apple, future Google) issues sessions identically.
   */
  async issueSession(provisioned: ProvisionedUser): Promise<AuthTokens> {
    const { token: refreshToken } = await this.refreshTokenService.issue(provisioned.userId);
    const accessToken = this.signAccessToken(provisioned.userId);

    return {
      accessToken,
      refreshToken,
      user: { id: provisioned.userId, email: provisioned.email },
      householdId: provisioned.householdId,
    };
  }

  async refresh(presentedToken: string): Promise<AuthTokens> {
    const rotated = await this.refreshTokenService.rotate(presentedToken);
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });

    if (!user) {
      throw new UnauthorizedException();
    }

    const household = await this.prisma.household.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!household) {
      // Invariant break — every user provisioned via verifyOtp owns a
      // household. Defensive: do not silently create one here.
      throw new InternalServerErrorException();
    }

    return {
      accessToken: this.signAccessToken(user.id),
      refreshToken: rotated.token,
      user: { id: user.id, email: user.email },
      householdId: household.id,
    };
  }

  async logout(presentedToken: string): Promise<LogoutResult> {
    await this.refreshTokenService.revokeFamily(presentedToken);
    return { ok: true };
  }

  private signAccessToken(userId: string): string {
    return this.jwtService.sign({ sub: userId }, { expiresIn: ACCESS_TOKEN_TTL });
  }

  private async provisionOrGetUser(email: string): Promise<ProvisionedUser> {
    const normalizedEmail = email.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });

      if (!existing) {
        return this.provisionNewAccount(tx, { email: normalizedEmail });
      }

      const household = await tx.household.findFirst({
        where: { ownerId: existing.id },
        orderBy: { createdAt: "asc" },
      });

      if (!household) {
        // Invariant break — every user provisioned via verifyOtp or
        // provisionNewAccount owns a household. Defensive: do not
        // silently create one here.
        throw new InternalServerErrorException();
      }

      return { userId: existing.id, email: existing.email, householdId: household.id };
    });
  }

  /**
   * Creates a new User + owned Household + OWNER Membership — the same
   * account shape as OTP first-verify. Shared by `provisionOrGetUser` and
   * `SocialAuthService` (T013/T014) so every provisioning path produces an
   * identical account structure. `tx` is a Prisma transaction client (or,
   * for direct callers outside a transaction, `PrismaService` itself).
   */
  async provisionNewAccount(tx: PrismaTx, params: NewAccountParams): Promise<ProvisionedUser> {
    const data: Prisma.UserCreateInput = {
      email: params.email,
      locale: DEFAULT_LOCALE,
      region: DEFAULT_REGION,
    };

    if (params.appleSub) {
      data.appleSub = params.appleSub;
    }

    if (params.googleSub) {
      data.googleSub = params.googleSub;
    }

    const user = await tx.user.create({ data });
    const household = await tx.household.create({
      data: { name: DEFAULT_HOUSEHOLD_NAME, ownerId: user.id },
    });
    await tx.membership.create({
      data: { userId: user.id, householdId: household.id, role: "OWNER" },
    });

    return { userId: user.id, email: user.email, householdId: household.id };
  }
}
