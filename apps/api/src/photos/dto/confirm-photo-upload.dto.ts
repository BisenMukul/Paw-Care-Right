import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ConfirmPhotoUploadDto {
  @ApiProperty({ example: "pets/<petId>/original/<uuid>.jpg" })
  @IsString()
  @IsNotEmpty()
  key!: string;
}
