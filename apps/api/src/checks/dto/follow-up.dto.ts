import { ApiProperty } from "@nestjs/swagger";
import { FOLLOW_UP_RESPONSES, type FollowUpResponse } from "@bombaypetcompany/types";
import { IsIn } from "class-validator";

/**
 * `POST /checks/:id/followup` body (T051). `FOLLOW_UP_RESPONSES` is the
 * single source of truth (`@bombaypetcompany/types`) shared with the Zod
 * `followUpResponseSchema` the mobile/api-client will consume later.
 */
export class FollowUpDto {
  @ApiProperty({ enum: FOLLOW_UP_RESPONSES })
  @IsIn(FOLLOW_UP_RESPONSES)
  response!: FollowUpResponse;
}
