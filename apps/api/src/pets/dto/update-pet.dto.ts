import { ApiProperty } from "@nestjs/swagger";
import { Sex, Species } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

/**
 * All fields optional (partial update). `breedSlug`/`photoKey`/`birthDate`/
 * `ageEstimateMonths`/`weightGrams` additionally accept an explicit `null`
 * to clear the field — `@IsOptional()` skips all further validators for
 * both `undefined` (field omitted) and `null` (explicit clear), so no
 * separate `@ValidateIf` is needed. `PetsService.update` distinguishes
 * "omitted" from "explicit null" via `"key" in dto`.
 */
export class UpdatePetDto {
  @ApiProperty({ enum: Object.values(Species), required: false })
  @IsOptional()
  @IsEnum(Species)
  species?: Species;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({ enum: Object.values(Sex), required: false })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  neutered?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  breedSlug?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  photoKey?: string | null;

  @ApiProperty({ required: false, nullable: true, example: "2020-01-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  ageEstimateMonths?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number | null;
}
