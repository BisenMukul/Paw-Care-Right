import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

import { INVITE_CODE_REGEX } from "../invite-code";

export class AcceptInviteDto {
  @ApiProperty({ example: "AB3DEFGH" })
  @IsString()
  @Matches(INVITE_CODE_REGEX)
  code!: string;
}
