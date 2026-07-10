import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { JWTVerifyGetKey } from "jose";
import { jwtVerify } from "jose";

import { AppConfigService } from "../../config/app-config.service";
import type { SocialTokenVerifier, VerifiedSocialIdentity } from "./social-verifier";

// Google legitimately emits both forms of `iss` on its OIDC id_tokens; both
// must be accepted or valid users would be rejected (see plan R3).
export const GOOGLE_ISSUERS: string[] = ["https://accounts.google.com", "accounts.google.com"];
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

// -> jose key-resolver fn (JWTVerifyGetKey). Production binds this to
// `createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))` (fetch + cache) in
// auth.module.ts; tests override it with a local, offline JWKS.
export const GOOGLE_JWKS_RESOLVER = Symbol("GOOGLE_JWKS_RESOLVER");

/**
 * Verifies Google Sign-In identity tokens (JWS) against Google's JWKS. Every
 * verification failure — bad signature, wrong issuer/audience, expiry,
 * unexpected algorithm, malformed token — collapses to a bare
 * `UnauthorizedException`; the identity token itself is never logged.
 */
@Injectable()
export class GoogleTokenVerifier implements SocialTokenVerifier {
  readonly provider = "google" as const;

  constructor(
    @Inject(GOOGLE_JWKS_RESOLVER) private readonly keyResolver: JWTVerifyGetKey,
    private readonly config: AppConfigService,
  ) {}

  async verify(identityToken: string): Promise<VerifiedSocialIdentity> {
    try {
      const { payload } = await jwtVerify(identityToken, this.keyResolver, {
        issuer: [...GOOGLE_ISSUERS],
        audience: this.config.googleClientId,
        algorithms: ["RS256"],
      });

      const email = typeof payload.email === "string" ? payload.email : null;
      // Google emits `email_verified` as a real JSON boolean — unlike Apple
      // we do NOT coerce strings; a mis-typed/absent claim fails upward to
      // 401 rather than silently linking to a victim's account (plan R4).
      const emailVerified = payload.email_verified === true;

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
