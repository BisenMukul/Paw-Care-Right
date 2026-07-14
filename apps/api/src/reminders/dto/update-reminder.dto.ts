import { ApiProperty } from "@nestjs/swagger";
import { REMINDER_TYPES } from "@pawcareright/types";
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsTimeZone, MaxLength } from "class-validator";

import { IsRRule } from "../validators/is-rrule.validator";

/**
 * All-optional partial update (mirrors `UpdatePetDto`'s posture). The
 * service distinguishes "omitted" from "present" via `dto.key !== undefined`
 * (same convention as `PetsService.update`) -- there is no nullable field
 * here to additionally distinguish "explicit null" for.
 */
export class UpdateReminderDto {
  @ApiProperty({ enum: REMINDER_TYPES, required: false })
  @IsOptional()
  @IsIn(REMINDER_TYPES)
  type?: string;

  @ApiProperty({ required: false, example: "Rabies booster" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false, example: "FREQ=YEARLY", description: "RFC5545-subset recurrence rule." })
  @IsOptional()
  @IsString()
  @IsRRule()
  rrule?: string;

  @ApiProperty({ required: false, example: "Europe/Paris", description: "IANA timezone id." })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiProperty({ required: false, example: "2026-08-01T09:00:00.000Z", description: "DTSTART recurrence anchor (UTC)." })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiProperty({
    required: false,
    maxLength: 120,
    description: "T061 medication subtype: name/dose exactly as entered by the user or their vet; never suggested.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  medNameAsEntered?: string;

  @ApiProperty({ required: false, description: "Pause (false) or resume (true) this reminder." })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
