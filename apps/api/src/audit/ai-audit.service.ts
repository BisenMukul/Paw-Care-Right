import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { AiAuditEntry } from "./ai-audit.types";

/**
 * Append-only `AiAuditLog` writer (T090 plan step 15). The class exposes
 * `record` and NOTHING ELSE — no `update`/`delete`/`deleteMany`/`upsert`, no
 * generic `prisma` re-export (bulk deletion lives in
 * `AiAuditRetentionService`, in `workers/`, which is never imported by any
 * request-path module). Never throws: an audit write must not kill a
 * streaming chat response (T082 F1 "nothing throws after headers") nor fail
 * an already-persisted triage job.
 */
@Injectable()
export class AiAuditService {
  private readonly logger = new Logger(AiAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AiAuditEntry): Promise<void> {
    try {
      const costMicroUsd = Math.max(0, Math.round(entry.costMicroUsd));

      await this.prisma.aiAuditLog.create({
        data: {
          surface: entry.surface,
          checkId: entry.surface === "CHECK" ? entry.checkId : null,
          threadId: entry.surface === "CHAT" ? entry.threadId : null,
          promptVersion: entry.promptVersion,
          modelId: entry.modelId,
          detectorFlags: entry.detectorFlags,
          costMicroUsd,
          ...(entry.latencyMs !== undefined ? { latencyMs: entry.latencyMs } : {}),
          status: entry.status,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({
        event: "ai_audit_write_failed",
        surface: entry.surface,
        ...(entry.surface === "CHECK" ? { checkId: entry.checkId } : { threadId: entry.threadId }),
        message,
      });
    }
  }
}
