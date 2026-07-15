import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/**
 * `POST /pets/:petId/reminders/medication-course` body (T061 plan): a
 * medication course = N sibling reminders (one per daily dose time), each
 * `FREQ=DAILY;COUNT=<courseLengthDays>` (plan decisions 1/2) -- a reminder
 * CADENCE, never dosing math. `medNameAsEntered`/`medDoseAsEntered` are
 * recorded EXACTLY as entered by the user or their vet -- never suggested,
 * never defaulted (CLAUDE §7 rule 2); Swagger descriptions below are
 * deliberately neutral, mirroring `CreateReminderDto.medNameAsEntered` (no
 * dose-like numeric example value for either field).
 */
export class CreateMedicationCourseDto {
  @ApiProperty({
    maxLength: 120,
    description: "Medication name exactly as entered by the user or their vet; never suggested.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  medNameAsEntered!: string;

  @ApiProperty({
    required: false,
    maxLength: 120,
    description: "Dose exactly as entered by the user or their vet; never suggested.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  medDoseAsEntered?: string;

  @ApiProperty({
    type: [String],
    example: ["2026-08-01T09:00:00.000Z"],
    description:
      "One UTC instant per daily dose time (reminder cadence only, not dosing advice) -- each becomes a sibling reminder anchored to this wall-clock time.",
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(12)
  @IsDateString({}, { each: true })
  doseStartAts!: string[];

  @ApiProperty({
    example: 10,
    description: "Number of days the reminder course runs (a reminder cadence, not a dosing duration).",
  })
  @IsInt()
  @Min(1)
  @Max(365)
  courseLengthDays!: number;

  @ApiProperty({ example: "Europe/Paris", description: "IANA timezone id." })
  @IsTimeZone()
  timezone!: string;
}
