import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, Max, Min } from "class-validator";

import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES, type AllowedContentType } from "../photos.constants";

export class CreatePhotoUploadUrlDto {
  @ApiProperty({ enum: ALLOWED_CONTENT_TYPES })
  @IsIn(ALLOWED_CONTENT_TYPES)
  contentType!: AllowedContentType;

  @ApiProperty({ example: 1_000_000, maximum: MAX_UPLOAD_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  contentLength!: number;
}
