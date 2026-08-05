import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import {
  AI_AUDIT_RETENTION_BATCH_SIZE,
  AI_AUDIT_RETENTION_DAYS,
  AI_AUDIT_RETENTION_MAX_BATCHES,
} from "./ai-audit-retention.contract";

const MS_PER_DAY = 86_400_000;

export interface RetentionReport {
  cutoff: Date;
  deleted: number;
  batches: number;
  exhausted: boolean;
}

/**
 * 90-day retention sweep for `AiAuditLog` (T090 plan step 19). `now` is a
 * REQUIRED parameter (injected clock, mirrors
 * `ReminderConsistencyService.checkConsistency(now)`) -- never `Date.now()`
 * inside. Idempotent: a second run over already-purged data deletes 0 rows.
 * `lt: cutoff`, strictly -- a row exactly at the boundary or newer is NEVER
 * deleted.
 */
@Injectable()
export class AiAuditRetentionService {
  private readonly logger = new Logger(AiAuditRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purge(now: Date): Promise<RetentionReport> {
    const cutoff = new Date(now.getTime() - AI_AUDIT_RETENTION_DAYS * MS_PER_DAY);

    let deleted = 0;
    let batches = 0;
    let exhausted = false;

    for (let i = 0; i < AI_AUDIT_RETENTION_MAX_BATCHES; i += 1) {
      const rows = await this.prisma.aiAuditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: AI_AUDIT_RETENTION_BATCH_SIZE,
        orderBy: { createdAt: "asc" },
      });

      if (rows.length === 0) {
        break;
      }

      await this.prisma.aiAuditLog.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
      deleted += rows.length;
      batches += 1;

      if (rows.length < AI_AUDIT_RETENTION_BATCH_SIZE) {
        break;
      }

      if (i === AI_AUDIT_RETENTION_MAX_BATCHES - 1) {
        exhausted = true;
      }
    }

    this.logger.log({
      event: "ai_audit_retention_done",
      cutoffEpochMs: cutoff.getTime(),
      deleted,
      batches,
      exhausted,
    });

    return { cutoff, deleted, batches, exhausted };
  }
}
