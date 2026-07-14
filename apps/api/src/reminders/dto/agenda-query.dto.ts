import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";

/**
 * `GET /agenda?from=&to=&petId=` query (plan "Endpoint specs"). `from`/`to`
 * are REQUIRED -- `RemindersService.agenda` additionally enforces the
 * ≤92-day, non-reversed window (plan "Agenda & expansion semantics" #1).
 */
export class AgendaQueryDto {
  @ApiProperty({ example: "2026-08-01T00:00:00.000Z", description: "Window start (inclusive), ISO-8601." })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: "2026-08-31T00:00:00.000Z", description: "Window end (inclusive), ISO-8601." })
  @IsDateString()
  to!: string;

  @ApiProperty({ required: false, description: "Restrict the agenda to a single pet in the household." })
  @IsOptional()
  @IsString()
  petId?: string;
}
