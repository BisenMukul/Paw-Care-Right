import { ApiProperty } from "@nestjs/swagger";
import { Species } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class BreedsQueryDto {
  @ApiProperty({ enum: Object.values(Species) })
  @IsEnum(Species)
  species!: Species;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  q?: string;
}
