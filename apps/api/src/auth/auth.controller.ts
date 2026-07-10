import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { Public } from "./auth.decorators";
import { AuthService, type AuthTokens, type LogoutResult, type RequestOtpResult } from "./auth.service";
import { LogoutDto } from "./dto/logout.dto";
import { OtpRequestDto } from "./dto/otp-request.dto";
import { OtpVerifyDto } from "./dto/otp-verify.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { SocialAuthDto } from "./dto/social-auth.dto";
import { OtpRateLimitGuard } from "./rate-limit.guard";
import { SocialAuthService } from "./social/social-auth.service";

// All five routes are `@Public()`: nothing in this module requires an
// access token. `otp/request`, `otp/verify`, and `social` are the sign-in
// entry points themselves — there is no token yet to require. `refresh`
// and `logout` are a deliberate deviation from the ARCHITECTURE §4 table
// (which does not mark them public): the presented refresh token IS the
// credential (opaque, hashed, family-revocable — see
// `RefreshTokenService`), so requiring a live access token on top is
// meaningless and self-defeating (refresh is called precisely when the
// access token has expired). `otp/request` additionally carries its own
// per-route rate-limit guard owned by this module.
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly socialAuthService: SocialAuthService,
  ) {}

  @Public()
  @Post("otp/request")
  @HttpCode(200)
  @UseGuards(OtpRateLimitGuard)
  @ApiOkResponse({ description: "Always 200, even for unknown emails (anti-enumeration)." })
  @ApiTooManyRequestsResponse({ description: "Rate limit exceeded (5/min/IP)." })
  requestOtp(@Body() dto: OtpRequestDto): Promise<RequestOtpResult> {
    return this.authService.requestOtp(dto.email);
  }

  @Public()
  @Post("otp/verify")
  @HttpCode(200)
  @ApiOkResponse({ description: "Verifies the OTP code and returns access + refresh tokens." })
  @ApiUnauthorizedResponse({ description: "Wrong, expired, or too-many-attempts code." })
  verifyOtp(@Body() dto: OtpVerifyDto): Promise<AuthTokens> {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOkResponse({ description: "Rotates the refresh token and returns a new token pair." })
  @ApiUnauthorizedResponse({ description: "Invalid, expired, or reused refresh token." })
  refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  @ApiOkResponse({ description: "Always 200, even for unknown tokens (idempotent, no probing)." })
  logout(@Body() dto: LogoutDto): Promise<LogoutResult> {
    return this.authService.logout(dto.refreshToken);
  }

  @Public()
  @Post("social")
  @HttpCode(200)
  @ApiOkResponse({ description: "Verifies the social identity token and returns access + refresh tokens." })
  @ApiUnauthorizedResponse({ description: "Invalid/unverifiable token, or no linkable identity." })
  socialLogin(@Body() dto: SocialAuthDto): Promise<AuthTokens> {
    return this.socialAuthService.login(dto.provider, dto.identityToken);
  }
}
