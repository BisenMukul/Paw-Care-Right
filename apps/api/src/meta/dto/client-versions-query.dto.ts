import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/** `days` bounds a look-back window over `Device.lastSeenAt` (T117 step 17). Default 30 applied at the call site (class-validator has no declarative default). */
export class ClientVersionsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 90, default: 30, description: "Look-back window in days (1-90)." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}
