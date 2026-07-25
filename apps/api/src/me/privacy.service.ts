import { InjectQueue } from "@nestjs/bullmq";
import { ConflictException, Injectable, Logger } from "@nestjs/common";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  type AccountDeletionStatus,
  type AccountExportRequest,
  type AccountPrivacySettings,
} from "@pawcareright/types";
import type { Queue } from "bullmq";

import { PrismaService } from "../prisma/prisma.service";
import { ACCOUNT_EXPORT_JOB_NAME, ACCOUNT_EXPORT_QUEUE, type AccountExportJobData } from "../workers/account-export.contract";

const MS_PER_DAY = 86_400_000;
const EXPORT_JOB_ATTEMPTS = 3;
const EXPORT_JOB_BACKOFF_DELAY_MS = 2000;

/**
 * `GET/PUT /me/privacy`, `POST /me/export`, `DELETE /me` business logic
 * (T091 plan step 28). D1 household-semantics + D2 grace-period soft-delete
 * effects live here; the hard cascade itself is `AccountErasureService`
 * (run later, out-of-request, by the daily sweep worker).
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ACCOUNT_EXPORT_QUEUE) private readonly exportQueue: Queue<AccountExportJobData>,
  ) {}

  async getSettings(userId: string): Promise<AccountPrivacySettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { analyticsOptOut: true, deletionScheduledAt: true },
    });

    return this.toSettings(user);
  }

  async updateSettings(userId: string, analyticsOptOut: boolean): Promise<AccountPrivacySettings> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { analyticsOptOut },
      select: { analyticsOptOut: true, deletionScheduledAt: true },
    });

    this.logger.log({ event: "privacy_settings_updated", userId, analyticsOptOut });
    return this.toSettings(user);
  }

  /**
   * Idempotent while a `PENDING` export already exists for this user
   * (plan step 28) -- also the cheap abuse guard against repeated
   * `POST /me/export` spam.
   */
  async requestExport(userId: string): Promise<AccountExportRequest> {
    const pending = await this.prisma.accountExport.findFirst({
      where: { userId, status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    });

    if (pending) {
      return this.toExportRequest(pending);
    }

    const created = await this.prisma.accountExport.create({ data: { userId } });

    await this.exportQueue.add(
      ACCOUNT_EXPORT_JOB_NAME,
      { exportId: created.id, userId },
      {
        jobId: created.id,
        attempts: EXPORT_JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: EXPORT_JOB_BACKOFF_DELAY_MS },
        removeOnFail: false,
      },
    );

    this.logger.log({ event: "account_export_requested", userId, exportId: created.id });
    return this.toExportRequest(created);
  }

  /**
   * D1 case analysis:
   *  (a) caller is a MEMBER of someone else's household -> allowed.
   *  (b) caller is OWNER and the household's ONLY membership -> allowed.
   *  (c) caller is OWNER with >=1 other membership -> BLOCKED, 409 CONFLICT
   *      (the global error-envelope filter maps `ConflictException` to the
   *      existing `CONFLICT` code -- no `errorCodeSchema` change, per plan).
   *
   * Idempotent: a second call while `deletionScheduledAt` is already set
   * returns it unchanged, no further writes.
   */
  async requestDeletion(userId: string): Promise<AccountDeletionStatus> {
    const memberships = await this.prisma.membership.findMany({ where: { userId } });
    if (memberships.length !== 1) {
      // Unsupported multi/zero-household state -- fails safe, mirrors
      // `HouseholdsService`'s own invariant guard.
      throw new ConflictException();
    }
    const sole = memberships[0]!;

    if (sole.role === "OWNER") {
      const siblingCount = await this.prisma.membership.count({
        where: { householdId: sole.householdId, userId: { not: userId } },
      });
      if (siblingCount > 0) {
        // D1 case (c): honest block -- no silent ownership transfer, no
        // household cascade that would delete another person's pets.
        throw new ConflictException();
      }
    }

    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { deletionScheduledAt: true },
    });

    if (existing.deletionScheduledAt !== null) {
      return { deletionScheduledAt: existing.deletionScheduledAt.toISOString() };
    }

    const now = new Date();
    const deletionScheduledAt = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * MS_PER_DAY);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { deletionScheduledAt, analyticsOptOut: true },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.device.deleteMany({ where: { userId } });
    });

    this.logger.log({ event: "account_deletion_scheduled", userId });
    return { deletionScheduledAt: deletionScheduledAt.toISOString() };
  }

  private toSettings(user: { analyticsOptOut: boolean; deletionScheduledAt: Date | null }): AccountPrivacySettings {
    return {
      analyticsOptOut: user.analyticsOptOut,
      deletionScheduledAt: user.deletionScheduledAt ? user.deletionScheduledAt.toISOString() : null,
    };
  }

  private toExportRequest(row: { id: string; status: string; requestedAt: Date }): AccountExportRequest {
    return {
      exportId: row.id,
      status: row.status as AccountExportRequest["status"],
      requestedAt: row.requestedAt.toISOString(),
    };
  }
}
