import { ApiProperty } from "@nestjs/swagger";
import { REMINDER_TYPES } from "@pawcareright/types";
import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsTimeZone, MaxLength } from "class-validator";

import { IsRRule } from "../validators/is-rrule.validator";

/**
 * Standalone DTO (T053 plan): `@IsRRule()` + the RRULE-subset validator are
 * exercised directly via `class-validator`'s `validate()` here (see
 * `create-reminder.dto.spec.ts`), proving AC2 "invalid rrule rejected at
 * the DTO layer" without an endpoint — the reminders controller/service
 * that actually wires this DTO into Nest's `ValidationPipe` is T055.
 *
 * `medNameAsEntered` records a name/dose exactly as the user or their vet
 * entered it (CLAUDE §7 / §5: the med tracker never suggests drug names or
 * dosages) — no default value, no medication copy here.
 */
export class CreateReminderDto {
  @ApiProperty({ enum: REMINDER_TYPES })
  @IsIn(REMINDER_TYPES)
  type!: string;

  @ApiProperty({ example: "Rabies booster" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: "FREQ=YEARLY", description: "RFC5545-subset recurrence rule." })
  @IsString()
  @IsRRule()
  rrule!: string;

  @ApiProperty({ example: "Europe/Paris", description: "IANA timezone id." })
  @IsTimeZone()
  timezone!: string;

  @ApiProperty({ example: "2026-08-01T09:00:00.000Z", description: "DTSTART recurrence anchor (UTC)." })
  @IsDateString()
  startAt!: string;

  @ApiProperty({
    required: false,
    maxLength: 120,
    description: "T061 medication subtype: name/dose exactly as entered by the user or their vet; never suggested.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  medNameAsEntered?: string;
}
