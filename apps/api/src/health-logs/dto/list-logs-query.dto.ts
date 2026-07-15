import { ApiProperty } from "@nestjs/swagger";
import { HEALTH_LOG_KINDS, type HealthLogKind } from "@pawcareright/types";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

/**
 * `GET /pets/:petId/logs` query (T064 plan D1/D3/D4). `limit` bounds mirror
 * `paginationQuerySchema` (1..100, default 20 -- applied in the service, not
 * here, so an absent `limit` stays `undefined` rather than defaulting at the
 * DTO layer, matching `ListChecksQueryDto`/`ListRemindersQueryDto`).
 * `cursor` is the opaque `timeline-cursor.ts` string, decoded + Zod-guarded
 * in the service (a malformed cursor -> `400`, never a 500). `kind` accepts
 * ALL six `HealthLogKind` values for filtering -- unlike the create-only
 * restriction, a filter on `MED_GIVEN`/`CHECK_REF` is a normal read.
 */
export class ListLogsQueryDto {
  @ApiProperty({ required: false, description: "Opaque cursor from a previous page's nextCursor." })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false, enum: HEALTH_LOG_KINDS })
  @IsOptional()
  @IsIn(HEALTH_LOG_KINDS)
  kind?: HealthLogKind;
}
