import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { JWTVerifyGetKey } from "jose";
import { jwtVerify } from "jose";

import { AppConfigService } from "../../config/app-config.service";
import type { SocialTokenVerifier, VerifiedSocialIdentity } from "./social-verifier";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

// -> jose key-resolver fn (JWTVerifyGetKey). Production binds this to
// `createRemoteJWKSet(new URL(APPLE_JWKS_URL))` (fetch + cache) in
// auth.module.ts; tests override it with a local, offline JWKS.
export const APPLE_JWKS_RESOLVER = Symbol("APPLE_JWKS_RESOLVER");

/**
 * Verifies Apple "Sign in with Apple" identity tokens (JWS) against Apple's
 * JWKS. Every verification failure — bad signature, wrong issuer/audience,
 * expiry, unexpected algorithm, malformed token — collapses to a bare
 * `UnauthorizedException`; the identity token itself is never logged.
 */
@Injectable()
export class AppleTokenVerifier implements SocialTokenVerifier {
  readonly provider = "apple" as const;

  constructor(
    @Inject(APPLE_JWKS_RESOLVER) private readonly keyResolver: JWTVerifyGetKey,
    private readonly config: AppConfigService,
  ) {}

  async verify(identityToken: string): Promise<VerifiedSocialIdentity> {
    try {
      const { payload } = await jwtVerify(identityToken, this.keyResolver, {
        issuer: APPLE_ISSUER,
        audience: this.config.appleClientId,
        algorithms: ["RS256"],
      });

      const email = typeof payload.email === "string" ? payload.email : null;
      const emailVerified = payload.email_verified === true || payload.email_verified === "true";

      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new UnauthorizedException();
      }

      return {
        provider: this.provider,
        subject: payload.sub,
        email,
        emailVerified,
      };
    } catch {
      // Never surface *why* verification failed (bad signature, wrong
      // iss/aud, expired, malformed, etc.) and never log the token.
      throw new UnauthorizedException();
    }
  }
}
