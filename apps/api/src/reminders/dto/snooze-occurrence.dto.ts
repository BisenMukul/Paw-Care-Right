import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

/**
 * `POST /reminders/:reminderId/snooze` body (T060 plan): snoozes an
 * occurrence keyed on the exact `dueAt` (decision 1) until `snoozeUntil`,
 * which the service enforces must be in the future (avoids an immediate
 * re-fire).
 */
export class SnoozeOccurrenceDto {
  @ApiProperty({ example: "2026-08-01T09:00:00.000Z", description: "The occurrence's exact dueAt, as returned by /agenda." })
  @IsDateString()
  dueAt!: string;

  @ApiProperty({ example: "2026-08-02T09:00:00.000Z", description: "When the occurrence should re-fire; must be in the future." })
  @IsDateString()
  snoozeUntil!: string;
}
