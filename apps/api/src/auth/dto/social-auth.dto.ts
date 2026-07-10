import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

import type { SocialProvider } from "../social/social-verifier";

// Apple + Google (T013/T014). The `@IsIn` allowlist (combined with the
// global `whitelist + forbidNonWhitelisted` ValidationPipe) rejects any
// other provider with a 400 VALIDATION_FAILED, before any verifier or DB
// work runs.
const SUPPORTED_PROVIDERS: SocialProvider[] = ["apple", "google"];

export class SocialAuthDto {
  @ApiProperty({ enum: SUPPORTED_PROVIDERS })
  @IsIn(SUPPORTED_PROVIDERS)
  provider!: SocialProvider;

  @ApiProperty({ description: "The provider's signed identity token (JWS)." })
  @IsString()
  @IsNotEmpty()
  identityToken!: string;
}
