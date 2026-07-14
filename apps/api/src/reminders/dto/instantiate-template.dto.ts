import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PROTOCOL_GROUPS, type ProtocolGroup } from "@pawcareright/data";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  ValidateNested,
} from "class-validator";

/**
 * A single reviewed item from the T059 wizard: which resolved pack item
 * (`templateKey` = item id) to instantiate, and an optional per-item
 * `startAt` override of the server-derived default.
 */
export class TemplateSelectionDto {
  @ApiProperty({ example: "rabies-core", description: "The resolved pack item id to instantiate." })
  @IsString()
  @IsNotEmpty()
  templateKey!: string;

  @ApiPropertyOptional({ description: "ISO-8601 start date override; defaults to the server-derived start when omitted." })
  @IsOptional()
  @IsDateString()
  startAt?: string;
}

/**
 * `POST /pets/:petId/reminders/from-template` body (plan "Instantiation
 * semantics"). `timezone` is required -- there is no tz on `Pet`/
 * `Household` (Risk R8), so every instantiated reminder's tz comes from
 * here (the T059 wizard passes the device tz). `group`/`countryCode` are
 * mutually-informative resolver inputs: an explicit `group` bypasses
 * `resolveCareTemplateForPet`'s country-based resolution entirely.
 */
export class InstantiateTemplateDto {
  @ApiProperty({ example: "Europe/Paris", description: "IANA timezone id applied to every created reminder." })
  @IsTimeZone()
  timezone!: string;

  @ApiProperty({ enum: PROTOCOL_GROUPS, required: false, description: "Explicit vaccine-protocol group override." })
  @IsOptional()
  @IsIn(PROTOCOL_GROUPS)
  group?: ProtocolGroup;

  @ApiProperty({ required: false, description: "ISO 3166-1 alpha-2 country code, used to resolve the protocol group when `group` is omitted." })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    type: [TemplateSelectionDto],
    description:
      "T059 wizard review: when present, only the listed templateKeys are instantiated (per-item startAt overrides the derived default); when absent, the entire resolved pack is instantiated with server-derived dates (unchanged behaviour).",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSelectionDto)
  selections?: TemplateSelectionDto[];
}
