import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/** `days` bounds the KPI look-back window (T111 step 9), mirroring `ClientVersionsQueryDto`. */
export class AdminKpisQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 90, default: 30, description: "Look-back window in days (1-90)." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}
