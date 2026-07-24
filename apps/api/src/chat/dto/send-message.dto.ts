import { ApiProperty } from "@nestjs/swagger";
import { CHAT_MESSAGE_MAX_CHARS } from "@pawcareright/types";
import { IsString, Length } from "class-validator";

/** `POST /chat/threads/:id/messages` body (T081). */
export class SendMessageDto {
  @ApiProperty({ maxLength: CHAT_MESSAGE_MAX_CHARS })
  @IsString()
  @Length(1, CHAT_MESSAGE_MAX_CHARS)
  content!: string;
}
