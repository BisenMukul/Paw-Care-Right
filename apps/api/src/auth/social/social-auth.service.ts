import { Inject, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { AuthService, type AuthTokens, type NewAccountParams, type ProvisionedUser } from "../auth.service";
import { SOCIAL_TOKEN_VERIFIERS, type SocialProvider, type SocialTokenVerifier, type VerifiedSocialIdentity } from "./social-verifier";

type PrismaTx = Prisma.TransactionClient | PrismaService;

/**
 * Provider-agnostic social sign-in: resolves the right `SocialTokenVerifier`
 * for the request, verifies the token, then finds-by-sub / links-by-email /
 * provisions a new account (identical shape to OTP first-verify) before
 * delegating session issuance to `AuthService.issueSession`. Every failure
 * mode — unresolved provider, verification failure, no linkable identity —
 * collapses to a bare `UnauthorizedException` (uniform 401, no token
 * leakage; see apple-token-verifier.ts).
 */
@Injectable()
export class SocialAuthService {
  private readonly verifiers: Map<SocialProvider, SocialTokenVerifier>;

  constructor(
    @Inject(SOCIAL_TOKEN_VERIFIERS) verifiers: SocialTokenVerifier[],
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
    this.verifiers = new Map(verifiers.map((verifier) => [verifier.provider, verifier]));
  }

  async login(provider: SocialProvider, identityToken: string): Promise<AuthTokens> {
    const verifier = this.verifiers.get(provider);

    if (!verifier) {
      throw new UnauthorizedException();
    }

    const identity = await verifier.verify(identityToken);
    const provisioned = await this.provisionOrLink(identity);

    return this.authService.issueSession(provisioned);
  }

  private async provisionOrLink(identity: VerifiedSocialIdentity): Promise<ProvisionedUser> {
    try {
      return await this.prisma.$transaction((tx) => this.linkOrProvision(tx, identity));
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        // Race: a concurrent request provisioned/linked this sub between
        // our find-by-sub read and our create/update write. Re-fetch by
        // sub rather than surfacing the write conflict.
        const existing = await this.prisma.user.findFirst({
          where: this.buildSubWhere(identity.provider, identity.subject),
        });

        if (existing) {
          return this.resolveProvisioned(this.prisma, existing);
        }
      }

      throw error;
    }
  }

  private async linkOrProvision(tx: PrismaTx, identity: VerifiedSocialIdentity): Promise<ProvisionedUser> {
    const bySub = await tx.user.findFirst({
      where: this.buildSubWhere(identity.provider, identity.subject),
    });

    if (bySub) {
      return this.resolveProvisioned(tx, bySub);
    }

    if (identity.email && identity.emailVerified) {
      const normalizedEmail = identity.email.trim().toLowerCase();
      const byEmail = await tx.user.findUnique({ where: { email: normalizedEmail } });

      if (byEmail) {
        const linked = await tx.user.update({
          where: { id: byEmail.id },
          data: this.buildSubData(identity.provider, identity.subject),
        });
        return this.resolveProvisioned(tx, linked);
      }

      return this.authService.provisionNewAccount(
        tx,
        this.buildNewAccountParams(identity.provider, normalizedEmail, identity.subject),
      );
    }

    // No sub match and no verified email to link/provision from — cannot
    // safely create an account (email is required + unique) and must not
    // link to a victim's account via an unverified/spoofed email claim.
    throw new UnauthorizedException();
  }

  private async resolveProvisioned(
    tx: PrismaTx,
    user: { id: string; email: string },
  ): Promise<ProvisionedUser> {
    const household = await tx.household.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!household) {
      // Invariant break — every user provisioned via provisionNewAccount
      // owns a household. Defensive, mirrors AuthService's own invariant.
      throw new InternalServerErrorException();
    }

    return { userId: user.id, email: user.email, householdId: household.id };
  }

  private buildSubWhere(provider: SocialProvider, subject: string): Prisma.UserWhereInput {
    switch (provider) {
      case "apple":
        return { appleSub: subject };
      case "google":
        return { googleSub: subject };
    }
  }

  private buildSubData(provider: SocialProvider, subject: string): Prisma.UserUpdateInput {
    switch (provider) {
      case "apple":
        return { appleSub: subject };
      case "google":
        return { googleSub: subject };
    }
  }

  private buildNewAccountParams(
    provider: SocialProvider,
    email: string,
    subject: string,
  ): NewAccountParams {
    switch (provider) {
      case "apple":
        return { email, appleSub: subject };
      case "google":
        return { email, googleSub: subject };
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
