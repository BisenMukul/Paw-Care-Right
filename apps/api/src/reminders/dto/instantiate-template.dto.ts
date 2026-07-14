import { ApiProperty } from "@nestjs/swagger";
import { PROTOCOL_GROUPS, type ProtocolGroup } from "@pawcareright/data";
import { IsIn, IsOptional, IsString, IsTimeZone } from "class-validator";

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
}
