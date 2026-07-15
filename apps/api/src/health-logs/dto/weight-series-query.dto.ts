import { ApiProperty } from "@nestjs/swagger";
import { IsISO8601, IsOptional } from "class-validator";

/** `GET /pets/:petId/weight-series` query: an optional `[from, to]` window (both inclusive-ISO bounds). */
export class WeightSeriesQueryDto {
  @ApiProperty({ required: false, example: "2026-01-01T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({ required: false, example: "2026-07-15T00:00:00.000Z" })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
