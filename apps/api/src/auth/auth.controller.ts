import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { AuthService, type AuthTokens, type LogoutResult, type RequestOtpResult } from "./auth.service";
import { LogoutDto } from "./dto/logout.dto";
import { OtpRequestDto } from "./dto/otp-request.dto";
import { OtpVerifyDto } from "./dto/otp-verify.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { OtpRateLimitGuard } from "./rate-limit.guard";

// No global auth guard exists yet at T012 (that machinery — `@Public()` +
// a global JWT guard — lands in T015). All four routes here are
// public-by-absence: nothing guards them, and `otp/request` additionally
// carries its own per-route rate-limit guard owned by this module.
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("otp/request")
  @HttpCode(200)
  @UseGuards(OtpRateLimitGuard)
  @ApiOkResponse({ description: "Always 200, even for unknown emails (anti-enumeration)." })
  @ApiTooManyRequestsResponse({ description: "Rate limit exceeded (5/min/IP)." })
  requestOtp(@Body() dto: OtpRequestDto): Promise<RequestOtpResult> {
    return this.authService.requestOtp(dto.email);
  }

  @Post("otp/verify")
  @HttpCode(200)
  @ApiOkResponse({ description: "Verifies the OTP code and returns access + refresh tokens." })
  @ApiUnauthorizedResponse({ description: "Wrong, expired, or too-many-attempts code." })
  verifyOtp(@Body() dto: OtpVerifyDto): Promise<AuthTokens> {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @Post("refresh")
  @HttpCode(200)
  @ApiOkResponse({ description: "Rotates the refresh token and returns a new token pair." })
  @ApiUnauthorizedResponse({ description: "Invalid, expired, or reused refresh token." })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(200)
  @ApiOkResponse({ description: "Always 200, even for unknown tokens (idempotent, no probing)." })
  logout(@Body() dto: LogoutDto): Promise<LogoutResult> {
    return this.authService.logout(dto.refreshToken);
  }
}
