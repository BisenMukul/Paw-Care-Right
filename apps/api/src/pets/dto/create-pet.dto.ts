import { ApiProperty } from "@nestjs/swagger";
import { Sex, Species } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class CreatePetDto {
  @ApiProperty({ enum: Object.values(Species) })
  @IsEnum(Species)
  species!: Species;

  @ApiProperty({ example: "Fido" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: Object.values(Sex), required: false })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  neutered?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  breedSlug?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  photoKey?: string;

  @ApiProperty({ required: false, example: "2020-01-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  ageEstimateMonths?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;
}
