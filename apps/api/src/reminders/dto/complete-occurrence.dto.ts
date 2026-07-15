import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

/**
 * `POST /reminders/:reminderId/complete` body (T060 plan): completes an
 * occurrence keyed on the exact `dueAt` the client read from `/agenda`
 * (decision 1) -- the client sends back the ISO string verbatim, no math.
 */
export class CompleteOccurrenceDto {
  @ApiProperty({ example: "2026-08-01T09:00:00.000Z", description: "The occurrence's exact dueAt, as returned by /agenda." })
  @IsDateString()
  dueAt!: string;
}
