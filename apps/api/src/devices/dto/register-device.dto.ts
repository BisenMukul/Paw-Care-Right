import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

/**
 * Matches both the legacy `ExponentPushToken[…]` and current
 * `ExpoPushToken[…]` shapes; rejects raw FCM/APNs tokens.
 */
export const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export const SUPPORTED_PLATFORMS = ["ios", "android"] as const;
export type DevicePlatform = (typeof SUPPORTED_PLATFORMS)[number];

/** Machine version-identifier shape only (T117) — never free text. */
export const VERSION_IDENTIFIER_REGEX = /^[A-Za-z0-9._+-]+$/;

export class RegisterDeviceDto {
  @ApiProperty({ example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" })
  @IsString()
  @Matches(EXPO_PUSH_TOKEN_REGEX)
  expoPushToken!: string;

  @ApiProperty({ enum: SUPPORTED_PLATFORMS })
  @IsIn(SUPPORTED_PLATFORMS)
  platform!: DevicePlatform;

  // T117: reported at JIT push registration only (`usePushRegistration`).
  // No PII (docs/store-privacy.md §2) — a plain version/update-id string,
  // never free text.
  @ApiPropertyOptional({ example: "1.2.3", description: "The reporting app's marketing version." })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(VERSION_IDENTIFIER_REGEX)
  appVersion?: string;

  @ApiPropertyOptional({ example: "0f1e2d3c-...", description: "The EAS OTA `Updates.updateId` running when the device registered, if any." })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(VERSION_IDENTIFIER_REGEX)
  otaUpdateId?: string;
}
