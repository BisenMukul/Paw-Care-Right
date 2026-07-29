import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_LOG_ENTRIES_MAX,
  FEEDBACK_LOG_EVENT_CODES,
  FEEDBACK_MESSAGE_MAX,
  type FeedbackCategory,
  type FeedbackLogEventCode,
} from "@bombaypetcompany/types";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

/** Bare identifier shape only (D3) -- never free text. Mirrors `packages/types/src/feedback.ts`'s `ERROR_NAME_PATTERN`. */
const ERROR_NAME_PATTERN = /^[A-Za-z0-9_$]{1,64}$/;
/** 32 lowercase hex characters -- a Sentry event id, never a raw breadcrumb (D5). */
const SENTRY_EVENT_ID_PATTERN = /^[0-9a-f]{32}$/;

/** One closed-shape entry from the mobile ring buffer (D3) -- no free-text field. */
export class FeedbackLogEntryDto {
  @ApiProperty({ description: "ISO-8601 timestamp the event was recorded at." })
  @IsISO8601()
  at!: string;

  @ApiProperty({ enum: ["error", "warn"] })
  @IsIn(["error", "warn"])
  level!: "error" | "warn";

  @ApiProperty({ enum: FEEDBACK_LOG_EVENT_CODES })
  @IsIn(FEEDBACK_LOG_EVENT_CODES)
  code!: FeedbackLogEventCode;

  @ApiPropertyOptional({ description: "Bare error-class identifier (e.g. TypeError), never free text." })
  @IsOptional()
  @IsString()
  @Matches(ERROR_NAME_PATTERN)
  errorName?: string;
}

/**
 * `POST /v1/feedback` body (T104 plan D3/D4/D5/step 7). Limits are imported
 * from `@bombaypetcompany/types` so the DTO can never re-type (and drift
 * from) the shared Zod contract. `FeedbackService.submit` re-checks the
 * `attachLogs`/`logs` consent invariant server-side independently of this
 * DTO's shape (the AC's actual server-side gate).
 */
export class SubmitFeedbackDto {
  @ApiProperty({ enum: FEEDBACK_CATEGORIES })
  @IsIn(FEEDBACK_CATEGORIES)
  category!: FeedbackCategory;

  @ApiProperty({ maxLength: FEEDBACK_MESSAGE_MAX })
  @IsString()
  @MinLength(1)
  @MaxLength(FEEDBACK_MESSAGE_MAX)
  message!: string;

  @ApiProperty({ enum: ["ios", "android"] })
  @IsIn(["ios", "android"])
  platform!: "ios" | "android";

  @ApiProperty({ maxLength: 32, example: "1.0.0" })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  appVersion!: string;

  @ApiProperty({ description: "Whether the caller consented to attaching device app logs." })
  @IsBoolean()
  attachLogs!: boolean;

  @ApiPropertyOptional({ type: [FeedbackLogEntryDto], maxItems: FEEDBACK_LOG_ENTRIES_MAX })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(FEEDBACK_LOG_ENTRIES_MAX)
  @ValidateNested({ each: true })
  @Type(() => FeedbackLogEntryDto)
  logs?: FeedbackLogEntryDto[];

  @ApiPropertyOptional({ maxLength: 512, description: "Key returned by POST /v1/feedback/screenshot-upload-url, once actually uploaded." })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  screenshotKey?: string;

  @ApiPropertyOptional({ description: "32 lowercase hex Sentry event id captured client-side at submit time (D5)." })
  @IsOptional()
  @IsString()
  @Matches(SENTRY_EVENT_ID_PATTERN)
  sentryEventId?: string;

  @ApiPropertyOptional({ maxLength: 128, example: "bombaypetcompany@1.0.0+abc1234" })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sentryRelease?: string;
}
