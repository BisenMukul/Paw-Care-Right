import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** T111 step 9: exact-match user lookup by email (normalised server-side to `.trim().toLowerCase()`). */
export class AdminUserLookupQueryDto {
  @ApiProperty({ description: "The user's email address (case/whitespace-insensitive; exact match).", maxLength: 320 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string;
}
