import { randomUUID } from "node:crypto";

import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { FeedbackLogEntry, FeedbackReportCreated } from "@bombaypetcompany/types";

import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { ScreenshotUploadUrlDto } from "./dto/screenshot-upload-url.dto";
import type { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import { buildScreenshotKey, isKeyInFeedbackNamespace } from "./feedback.constants";

const SCREENSHOT_CONTENT_TYPE = "image/jpeg";

export interface FeedbackScreenshotUploadUrlResponse {
  uploadUrl: string;
  key: string;
}

/**
 * `POST /v1/feedback[/screenshot-upload-url]` business logic (T104 plan
 * D3/D4/step 8). User-scoped, not household-scoped (mirrors
 * `PrivacyService`).
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createScreenshotUploadUrl(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- JUSTIFIED: kept for signature symmetry with `photosService.createUploadUrl`/future body fields; the DTO is intentionally empty (see its own header comment)
    _dto: ScreenshotUploadUrlDto,
  ): Promise<FeedbackScreenshotUploadUrlResponse> {
    const key = buildScreenshotKey(userId, randomUUID());
    const uploadUrl = await this.storage.getPresignedPutUrl({ key, contentType: SCREENSHOT_CONTENT_TYPE });
    return { uploadUrl, key };
  }

  async submit(userId: string, dto: SubmitFeedbackDto): Promise<FeedbackReportCreated> {
    // D3/AC2 -- the server-side consent gate: a payload cannot carry log
    // entries without having consented, regardless of what the DTO/schema
    // layers already reject (belt-and-braces, never trust the client alone).
    if (dto.attachLogs !== true && (dto.logs?.length ?? 0) > 0) {
      throw new BadRequestException("logs cannot be attached without attachLogs consent");
    }

    if (dto.screenshotKey !== undefined) {
      if (!isKeyInFeedbackNamespace(userId, dto.screenshotKey)) {
        throw new BadRequestException("screenshotKey does not belong to this user's feedback namespace");
      }
      const exists = await this.storage.objectExists(dto.screenshotKey);
      if (!exists) {
        throw new NotFoundException("uploaded screenshot object not found");
      }
    }

    const logsConsent = dto.attachLogs === true;
    const logs: FeedbackLogEntry[] = logsConsent ? (dto.logs ?? []) : [];

    const created = await this.prisma.feedbackReport.create({
      data: {
        userId,
        category: dto.category,
        message: dto.message,
        platform: dto.platform,
        appVersion: dto.appVersion,
        logsConsent,
        logs,
        screenshotKey: dto.screenshotKey ?? null,
        sentryEventId: dto.sentryEventId ?? null,
        sentryRelease: dto.sentryRelease ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // No `message` content in this log line (R3) -- only ids.
    this.logger.log({ event: "feedback_submitted", reportId: created.id, userId });

    return { reportId: created.id, createdAt: created.createdAt.toISOString() };
  }
}
