import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

/** T111 step 9: bounded page size + opaque keyset cursor for `/v1/admin/ai-audit`. */
export class AdminAuditQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50, description: "Page size (1-100)." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: "Opaque keyset cursor: the `id` of the last row from the previous page." })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
