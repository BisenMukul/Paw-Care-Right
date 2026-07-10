import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AppConfigService } from "../config/app-config.service";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { DevLogOtpTransport, OTP_TRANSPORT } from "./otp-transport";
import { OtpService } from "./otp.service";
import { OtpRateLimitGuard } from "./rate-limit.guard";
import { RefreshTokenService } from "./refresh-token.service";

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
  ],
})
export class AuthModule {}
