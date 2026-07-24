import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

/** `POST /chat/threads` body (T081). */
export class CreateThreadDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  petId!: string;
}
