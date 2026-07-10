import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { createRemoteJWKSet } from "jose";

import { AppConfigService } from "../config/app-config.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { DevLogOtpTransport, OTP_TRANSPORT } from "./otp-transport";
import { OtpService } from "./otp.service";
import { OtpRateLimitGuard } from "./rate-limit.guard";
import { RefreshTokenService } from "./refresh-token.service";
import { APPLE_JWKS_RESOLVER, APPLE_JWKS_URL, AppleTokenVerifier } from "./social/apple-token-verifier";
import { GOOGLE_JWKS_RESOLVER, GOOGLE_JWKS_URL, GoogleTokenVerifier } from "./social/google-token-verifier";
import { SocialAuthService } from "./social/social-auth.service";
import { SOCIAL_TOKEN_VERIFIERS, type SocialTokenVerifier } from "./social/social-verifier";

// ConfigModule is `@Global()` (see config.module.ts), so AppConfigService
// needs no explicit import here. PrismaModule/RedisModule are NOT global
// and must be imported for their exported services to be injectable below.
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    JwtModule.registerAsync({
      useFactory: (config: AppConfigService) => ({ secret: config.jwtSecret }),
      inject: [AppConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    RefreshTokenService,
    OtpRateLimitGuard,
    { provide: OTP_TRANSPORT, useClass: DevLogOtpTransport },
    SocialAuthService,
    AppleTokenVerifier,
    // Production JWKS resolver: fetches + caches Apple's public keys.
    // Tests override this provider with a local, offline JWKS (see
    // auth-social.e2e-spec.ts).
    { provide: APPLE_JWKS_RESOLVER, useFactory: () => createRemoteJWKSet(new URL(APPLE_JWKS_URL)) },
    GoogleTokenVerifier,
    // Production JWKS resolver: fetches + caches Google's public keys.
    // Tests override this provider with a local, offline JWKS (see
    // auth-social.e2e-spec.ts).
    { provide: GOOGLE_JWKS_RESOLVER, useFactory: () => createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)) },
    {
      provide: SOCIAL_TOKEN_VERIFIERS,
      useFactory: (apple: AppleTokenVerifier, google: GoogleTokenVerifier): SocialTokenVerifier[] => [
        apple,
        google,
      ],
      inject: [AppleTokenVerifier, GoogleTokenVerifier],
    },
  ],
})
export class AuthModule {}
