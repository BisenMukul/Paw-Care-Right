import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

/**
 * `PUT /me/privacy` body (T091 plan step 29). Mirrors `packages/types`'
 * `updateAccountPrivacySettingsSchema` field-for-field.
 */
export class UpdatePrivacySettingsDto {
  @ApiProperty({ description: "Whether the caller has opted out of product analytics." })
  @IsBoolean()
  analyticsOptOut!: boolean;
}
