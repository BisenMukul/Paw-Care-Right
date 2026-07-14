import { ApiProperty } from "@nestjs/swagger";
import { QUIET_TIME_REGEX, REMINDER_TYPES } from "@pawcareright/types";
import { Type } from "class-transformer";
import { ArrayUnique, IsArray, IsIn, IsOptional, IsTimeZone, Matches, ValidateNested } from "class-validator";

/**
 * Nested `quietHours` (T058 plan decision 5): an all-or-nothing trio. A
 * partial object (e.g. `start` with no `timezone`) is rejected by
 * `@ValidateNested` + each field's own required validator -- there is no
 * "some fields optional" escape hatch here.
 */
export class QuietHoursDto {
  @ApiProperty({ example: "22:00", description: "Quiet-hours start, 24-hour HH:mm, in `timezone`." })
  @Matches(QUIET_TIME_REGEX)
  start!: string;

  @ApiProperty({ example: "07:00", description: "Quiet-hours end (exclusive), 24-hour HH:mm, in `timezone`." })
  @Matches(QUIET_TIME_REGEX)
  end!: string;

  @ApiProperty({ example: "Europe/Paris", description: "IANA timezone id." })
  @IsTimeZone()
  timezone!: string;
}

/**
 * `PUT /me/notification-prefs` body (T058 plan). `disabledTypes` lists the
 * `REMINDER_TYPES` the caller has turned OFF -- an empty array (the
 * default) means every type is on. `quietHours: null` clears the window.
 */
export class UpdateNotificationPrefsDto {
  @ApiProperty({ enum: REMINDER_TYPES, isArray: true, default: [] })
  @IsArray()
  @IsIn(REMINDER_TYPES, { each: true })
  @ArrayUnique()
  disabledTypes!: string[];

  @ApiProperty({ type: QuietHoursDto, nullable: true, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto | null;
}
