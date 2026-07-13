import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsObject, IsOptional, IsString } from "class-validator";

/**
 * `intake` is deep-validated by `parseIntake` (`@pawcareright/types`) inside
 * `ChecksService.create` — this DTO only guards the outer shape (an object)
 * so class-validator rejects non-object bodies before the service runs.
 * `Idempotency-Key` is a request header, not a body field (see the
 * controller).
 */
export class CreateCheckDto {
  @ApiProperty({
    description: "A completed symptom-intake object, validated server-side by parseIntake.",
    type: "object",
    additionalProperties: true,
  })
  @IsObject()
  intake!: Record<string, unknown>;

  @ApiProperty({ required: false, type: [String], description: "Object storage keys for attached photos." })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoKeys?: string[];
}
