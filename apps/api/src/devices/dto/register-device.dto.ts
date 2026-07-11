import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Matches } from "class-validator";

/**
 * Matches both the legacy `ExponentPushToken[…]` and current
 * `ExpoPushToken[…]` shapes; rejects raw FCM/APNs tokens.
 */
export const EXPO_PUSH_TOKEN_REGEX = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export const SUPPORTED_PLATFORMS = ["ios", "android"] as const;
export type DevicePlatform = (typeof SUPPORTED_PLATFORMS)[number];

export class RegisterDeviceDto {
  @ApiProperty({ example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" })
  @IsString()
  @Matches(EXPO_PUSH_TOKEN_REGEX)
  expoPushToken!: string;

  @ApiProperty({ enum: SUPPORTED_PLATFORMS })
  @IsIn(SUPPORTED_PLATFORMS)
  platform!: DevicePlatform;
}
