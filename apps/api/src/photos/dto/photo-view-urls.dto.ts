import { ApiProperty } from "@nestjs/swagger";
import { HEALTH_LOG_PHOTO_KEYS_MAX } from "@pawcareright/types";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from "class-validator";

/**
 * `POST /pets/:id/photo-view-urls` body — the keys to presign view URLs
 * for. Mirrors `create-log.dto.ts`'s `photoKeys` guard (same
 * `HEALTH_LOG_PHOTO_KEYS_MAX` ceiling), but requires at least one key since
 * this endpoint's whole purpose is signing keys the caller already holds.
 */
export class PhotoViewUrlsDto {
  @ApiProperty({
    type: [String],
    description: `Object storage (original) keys to presign view URLs for (1-${HEALTH_LOG_PHOTO_KEYS_MAX}).`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(HEALTH_LOG_PHOTO_KEYS_MAX)
  @IsString({ each: true })
  keys!: string[];
}
