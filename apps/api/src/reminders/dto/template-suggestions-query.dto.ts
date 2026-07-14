import { ApiPropertyOptional } from "@nestjs/swagger";
import { PROTOCOL_GROUPS, type ProtocolGroup } from "@pawcareright/data";
import { IsIn, IsOptional, IsString } from "class-validator";

/**
 * `GET /pets/:petId/reminders/template-suggestions?group=&countryCode=` query
 * (T059 plan). Mirrors `InstantiateTemplateDto` minus `timezone` -- the
 * suggestions endpoint is read-only and derives no `timezone`-dependent
 * `nextFireAt`.
 */
export class TemplateSuggestionsQueryDto {
  @ApiPropertyOptional({ enum: PROTOCOL_GROUPS, description: "Explicit vaccine-protocol group override." })
  @IsOptional()
  @IsIn(PROTOCOL_GROUPS)
  group?: ProtocolGroup;

  @ApiPropertyOptional({ description: "ISO 3166-1 alpha-2 country code, used to resolve the protocol group when `group` is omitted." })
  @IsOptional()
  @IsString()
  countryCode?: string;
}
