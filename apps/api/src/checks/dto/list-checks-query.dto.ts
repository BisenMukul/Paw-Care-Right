import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

/** Bounds mirror `@pawcareright/types`' `paginationQuerySchema` (1..100, default 20). */
export class ListChecksQueryDto {
  @ApiProperty({ required: false, description: "Opaque cursor: the `id` of the last item from the previous page." })
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
}
