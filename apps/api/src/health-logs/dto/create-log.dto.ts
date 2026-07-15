import { ApiProperty } from "@nestjs/swagger";
import { HEALTH_LOG_PHOTO_KEYS_MAX } from "@pawcareright/types";
import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsObject, IsOptional, IsString } from "class-validator";

/**
 * `POST /pets/:petId/logs` body (T064 plan decisions D4/D5). `kind` is
 * restricted to the public-creatable set -- `MED_GIVEN` (a read-time
 * projection, never a written-through row) and `CHECK_REF` (no source
 * writes these yet) are rejected here with a `400`, matching the outer
 * `@IsIn` guard. `value`'s deep per-kind shape is validated inside the
 * service via `parseHealthLogValue` (fail-closed `400` on mismatch) --
 * this DTO only guards the outer shape.
 */
export const CREATABLE_HEALTH_LOG_KINDS = ["WEIGHT", "MEAL", "NOTE", "VET_VISIT"] as const;
export type CreatableHealthLogKind = (typeof CREATABLE_HEALTH_LOG_KINDS)[number];

export class CreateLogDto {
  @ApiProperty({ enum: CREATABLE_HEALTH_LOG_KINDS })
  @IsIn(CREATABLE_HEALTH_LOG_KINDS)
  kind!: CreatableHealthLogKind;

  @ApiProperty({ example: "2026-07-15T09:00:00.000Z" })
  @IsISO8601()
  occurredAt!: string;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    description: "The kind-specific record fields, deep-validated server-side by parseHealthLogValue.",
  })
  @IsObject()
  value!: Record<string, unknown>;

  @ApiProperty({
    required: false,
    type: [String],
    description: `Object storage keys for attached photos (max ${HEALTH_LOG_PHOTO_KEYS_MAX}).`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(HEALTH_LOG_PHOTO_KEYS_MAX)
  @IsString({ each: true })
  photoKeys?: string[];
}
