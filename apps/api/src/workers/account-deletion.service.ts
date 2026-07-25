import { Injectable, Logger } from "@nestjs/common";
import { ACCOUNT_EXPORT_RETENTION_DAYS } from "@pawcareright/types";

import { AccountErasureService } from "../me/account-erasure.service";
import { captureApiMessage } from "../observability/sentry";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import {
  ACCOUNT_DELETION_BATCH_SIZE,
  ACCOUNT_DELETION_MAX_BATCHES,
} from "./account-deletion.contract";

const MS_PER_DAY = 86_400_000;

export interface SweepReport {
  now: Date;
  usersScanned: number;
  usersErased: number;
  usersFailed: number;
  batches: number;
  exhausted: boolean;
  exportsPurged: number;
}

/**
 * The daily hard-deletion sweep (T091 plan D2/D6, step 25). `now` is a
 * REQUIRED injected-clock parameter (never `Date.now()` inside, mirrors
 * `AiAuditRetentionService.purge(now)`/`ReminderConsistencyService
 * .checkConsistency(now)`) so grace-period enforcement is deterministically
 * testable.
 *
 * `lte: now`, strictly -- a user whose `deletionScheduledAt` has not yet
 * elapsed is NEVER touched (plan step 25). One failing user's erasure is
 * caught, logged ids-only, and does NOT abort the batch -- every other due
 * user still gets processed.
 *
 * After the due-deletion sweep, purges `AccountExport` rows (+ their S3
 * objects) older than `ACCOUNT_EXPORT_RETENTION_DAYS` (D6) -- without this,
 * a full personal-data JSON bundle would sit in S3 forever.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly erasure: AccountErasureService,
    private readonly storage: StorageService,
  ) {}

  async sweep(now: Date): Promise<SweepReport> {
    let usersScanned = 0;
    let usersErased = 0;
    let usersFailed = 0;
    let batches = 0;
    let exhausted = false;

    for (let i = 0; i < ACCOUNT_DELETION_MAX_BATCHES; i += 1) {
      const users = await this.prisma.user.findMany({
        where: { deletionScheduledAt: { lte: now } },
        select: { id: true },
        take: ACCOUNT_DELETION_BATCH_SIZE,
      });

      if (users.length === 0) {
        break;
      }

      batches += 1;
      usersScanned += users.length;

      for (const user of users) {
        try {
          await this.erasure.erase(user.id);
          usersErased += 1;
        } catch (err) {
          usersFailed += 1;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn({ event: "account_deletion_user_failed", userId: user.id, message });
          // F6 (checker review): a per-user erasure failure previously only
          // `logger.warn`'d -- a permanently-failing erasure (e.g. an FK
          // violation from an uncollected row) would then silently repeat
          // on every subsequent daily sweep forever, with nothing paging
          // anyone. `captureApiMessage` (T089/T090 alert-only pattern) is
          // fail-closed (a Sentry outage can never throw out of this call)
          // and carries ids/counts only -- never `message`'s free-text
          // content (which may echo Prisma error internals), matching
          // `AnomalyService`'s own tag discipline.
          captureApiMessage("account_deletion_user_erasure_failed", { userId: user.id });
        }
      }

      if (users.length < ACCOUNT_DELETION_BATCH_SIZE) {
        break;
      }

      if (i === ACCOUNT_DELETION_MAX_BATCHES - 1) {
        exhausted = true;
      }
    }

    const exportsPurged = await this.purgeExpiredExports(now);

    this.logger.log({
      event: "account_deletion_sweep_done",
      usersScanned,
      usersErased,
      usersFailed,
      batches,
      exhausted,
      exportsPurged,
    });

    return { now, usersScanned, usersErased, usersFailed, batches, exhausted, exportsPurged };
  }

  private async purgeExpiredExports(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - ACCOUNT_EXPORT_RETENTION_DAYS * MS_PER_DAY);

    const rows = await this.prisma.accountExport.findMany({
      where: { requestedAt: { lt: cutoff } },
      select: { id: true, objectKey: true },
    });

    if (rows.length === 0) {
      return 0;
    }

    for (const row of rows) {
      if (row.objectKey !== null) {
        await this.storage.deleteObject(row.objectKey);
      }
    }

    await this.prisma.accountExport.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });

    return rows.length;
  }
}
