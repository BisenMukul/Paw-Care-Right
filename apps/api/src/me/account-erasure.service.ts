import { Injectable, Logger } from "@nestjs/common";

import { deriveMainKey, deriveThumbKey } from "../photos/photos.constants";
import { PrismaService } from "../prisma/prisma.service";
import type { QuotaMetric, QuotaWindow } from "../quota/quota.types";
import { quotaKey } from "../quota/quota.util";
import { RedisService } from "../redis/redis.service";
import { StorageService } from "../storage/storage.service";

/** Every metric x window pair (T091 plan step 16) -- covers the persistent `total` lifetime counters; day/month leftovers self-expire. */
const QUOTA_METRICS: readonly QuotaMetric[] = ["checks", "foodLookups", "chatMessages"];
const QUOTA_WINDOWS: readonly QuotaWindow[] = ["day", "month", "total"];

export type ErasureMode = "NONE" | "FULL_HOUSEHOLD" | "USER_ONLY";

export interface ErasureReport {
  mode: ErasureMode;
  deletedChecks: number;
  deletedThreads: number;
  deletedAuditLogs: number;
  deletedS3Keys: number;
}

const ZERO_REPORT: ErasureReport = {
  mode: "NONE",
  deletedChecks: 0,
  deletedThreads: 0,
  deletedAuditLogs: 0,
  deletedS3Keys: 0,
};

/**
 * The hard erasure cascade for `DELETE /me` (T091 plan D1/D3, the heart of
 * AC1). Runs as a BullMQ job body (`AccountDeletionService.sweep` ->
 * `AccountDeletionProcessor`), never inline in a request handler.
 *
 * IDEMPOTENT by construction (plan step 12): a user with no `Membership` row
 * left (already erased, or a row that never existed) is a no-op returning
 * `ZERO_REPORT` -- no throw.
 *
 * D1 case selection (mirrors `PrivacyService.requestDeletion`'s own gate,
 * belt-and-braces): role OWNER + 0 sibling memberships -> FULL_HOUSEHOLD
 * (the household has no other member); role MEMBER -> USER_ONLY (the
 * household, its pets, health logs and reminders survive); role OWNER with
 * >=1 sibling membership should already have been rejected by
 * `requestDeletion`'s 409 -- reaching this method in that state is an
 * invariant violation and is rethrown so the job dead-letters rather than
 * silently doing the wrong thing (plan step 13).
 *
 * S3 phase runs BEFORE the DB phase (plan risk R6): a crash between the two
 * leaves rows pointing at missing objects (a photo 404) rather than
 * orphaned, unreferenced personal photos with no DB pointer left to find
 * them again -- strictly worse for privacy. Retry + idempotency close the
 * window.
 */
@Injectable()
export class AccountErasureService {
  private readonly logger = new Logger(AccountErasureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  async erase(userId: string): Promise<ErasureReport> {
    const membership = await this.prisma.membership.findFirst({ where: { userId } });

    if (!membership) {
      // Already erased (or never existed) -- idempotent no-op.
      this.logger.log({ event: "account_erasure_noop_no_membership", userId });
      return ZERO_REPORT;
    }

    const { householdId, role } = membership;
    const siblingCount = await this.prisma.membership.count({
      where: { householdId, userId: { not: userId } },
    });

    if (role === "OWNER" && siblingCount > 0) {
      // Should already have been blocked at `requestDeletion` (409). Reaching
      // here is a hard invariant violation -- dead-letter, never guess.
      const message = `account-erasure: OWNER with ${siblingCount} live co-member(s) reached erase() for user ${userId}`;
      this.logger.error({ event: "account_erasure_invariant_violation", userId, householdId, siblingCount });
      throw new Error(message);
    }

    if (role === "OWNER") {
      return this.eraseFullHousehold(userId, householdId);
    }
    return this.eraseUserOnly(userId, householdId);
  }

  private async eraseFullHousehold(userId: string, householdId: string): Promise<ErasureReport> {
    const pets = await this.prisma.pet.findMany({ where: { householdId }, select: { id: true } });
    const petIds = pets.map((pet) => pet.id);

    // F1 fix (checker review): the "every user has exactly one Membership at
    // all times" invariant does NOT mean a user's membership never MOVES --
    // `HouseholdsService.leaveHousehold` re-provisions a fresh solo household
    // for the leaver while dropping their old membership, leaving behind any
    // `SymptomCheck`/`ChatThread` they authored on the OLD household's pets
    // (still `createdById = userId`). `SymptomCheck.createdBy` is
    // `onDelete: Restrict`, so collecting by `petId` alone here would miss
    // those rows entirely and `tx.user.delete` below would throw P2003 --
    // silently, forever, on every subsequent sweep (the account is never
    // erased). Collecting by `OR: [petId in household, createdById = user]`
    // catches BOTH the household's own rows (full-household case) AND any
    // orphaned rows the user authored elsewhere before leaving.
    const checks = await this.prisma.symptomCheck.findMany({
      where: { OR: [{ petId: { in: petIds } }, { createdById: userId }] },
      select: { id: true },
    });
    const checkIds = checks.map((check) => check.id);

    // Mirrored for the SAME reason -- not for an FK reason (`ChatThread
    // .createdBy` is `onDelete: Cascade`, so `tx.user.delete` would reap an
    // orphaned thread regardless), but so the D3 `AiAuditLog` rows keyed to
    // those orphaned threads are actually collected and hard-deleted here
    // rather than left to age out on their own 90-day retention sweep.
    const threads = await this.prisma.chatThread.findMany({
      where: { OR: [{ petId: { in: petIds } }, { createdById: userId }] },
      select: { id: true },
    });
    const threadIds = threads.map((thread) => thread.id);

    const s3Keys: string[] = [];
    for (const petId of petIds) {
      s3Keys.push(...(await this.storage.listKeys(`pets/${petId}/`)));
    }
    s3Keys.push(...(await this.storage.listKeys(`exports/${userId}/`)));
    // T104 (plan D7): `FeedbackReport` FK-cascades from `User` (so the DB
    // rows are removed by `tx.user.delete` below), but that cascade does not
    // reach S3 -- a submitted screenshot's object must be erased alongside
    // the account exactly like the export bundle above.
    s3Keys.push(...(await this.storage.listKeys(`feedback/${userId}/`)));

    const deletedAuditLogs = await this.deleteAuditLogs(checkIds, threadIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.chatThread.deleteMany({ where: { id: { in: threadIds } } });
      await tx.symptomCheck.deleteMany({ where: { id: { in: checkIds } } });
      // Cascades Membership, Pet -> Reminder -> ReminderEvent, HealthLog,
      // HouseholdInvite, Subscription. `Household.owner` is `onDelete:
      // Restrict`, so this MUST precede the user delete.
      await tx.household.delete({ where: { id: householdId } });
      // Cascades Device, RefreshToken, UserNotificationPrefs, created
      // HouseholdInvites, Subscription, AccountExport, and (T108) any
      // ReferralGrant this user RECEIVED -- a grant given to someone else
      // survives with counterpartyUserId set to null (onDelete: SetNull).
      await tx.user.delete({ where: { id: userId } });
    });

    await this.deleteQuotaCounters(userId);

    await this.deleteS3Keys(s3Keys);

    this.logger.log({
      event: "account_erasure_done",
      userId,
      mode: "FULL_HOUSEHOLD",
      deletedChecks: checkIds.length,
      deletedThreads: threadIds.length,
      deletedAuditLogs,
      deletedS3Keys: s3Keys.length,
    });

    return {
      mode: "FULL_HOUSEHOLD",
      deletedChecks: checkIds.length,
      deletedThreads: threadIds.length,
      deletedAuditLogs,
      deletedS3Keys: s3Keys.length,
    };
  }

  private async eraseUserOnly(userId: string, householdId: string): Promise<ErasureReport> {
    const checks = await this.prisma.symptomCheck.findMany({
      where: { createdById: userId },
      select: { id: true, photoKeys: true },
    });
    const checkIds = checks.map((check) => check.id);

    const threads = await this.prisma.chatThread.findMany({
      where: { createdById: userId },
      select: { id: true },
    });
    const threadIds = threads.map((thread) => thread.id);

    const deletableKeys = await this.computeDeletableUserOnlyKeys(userId, householdId, checks);
    // T104 (plan D7): mirrors the FULL_HOUSEHOLD branch above -- the
    // `feedback/<userId>/` S3 prefix is never shared with another member,
    // so it is always safe to erase in full here too.
    const s3Keys = [
      ...deletableKeys,
      ...(await this.storage.listKeys(`exports/${userId}/`)),
      ...(await this.storage.listKeys(`feedback/${userId}/`)),
    ];

    const deletedAuditLogs = await this.deleteAuditLogs(checkIds, threadIds);

    await this.prisma.$transaction(async (tx) => {
      await tx.chatThread.deleteMany({ where: { id: { in: threadIds } } });
      await tx.symptomCheck.deleteMany({ where: { id: { in: checkIds } } });
      await tx.membership.deleteMany({ where: { userId } });
      // Cascades Device, RefreshToken, UserNotificationPrefs, created
      // HouseholdInvites, Subscription, AccountExport, and (T108) any
      // ReferralGrant this user RECEIVED -- a grant given to someone else
      // survives with counterpartyUserId set to null (onDelete: SetNull).
      await tx.user.delete({ where: { id: userId } });
    });

    await this.deleteQuotaCounters(userId);

    await this.deleteS3Keys(s3Keys);

    this.logger.log({
      event: "account_erasure_done",
      userId,
      mode: "USER_ONLY",
      deletedChecks: checkIds.length,
      deletedThreads: threadIds.length,
      deletedAuditLogs,
      deletedS3Keys: s3Keys.length,
    });

    return {
      mode: "USER_ONLY",
      deletedChecks: checkIds.length,
      deletedThreads: threadIds.length,
      deletedAuditLogs,
      deletedS3Keys: s3Keys.length,
    };
  }

  /**
   * Plan step 14/risk R7: a member's own check-photo keys are safe to delete
   * from S3 ONLY when no surviving row in the household still points at
   * them. The surviving-reference set is built from every row that outlives
   * a USER_ONLY erasure: the household's `Pet.photoKey`s, its `HealthLog`
   * `photoKeys`, and every OTHER member's `SymptomCheck.photoKeys`. A key
   * (original + its derived main/thumb renditions) is treated as one
   * indivisible group -- if ANY member of the group is still referenced,
   * NONE of the group is deleted (conservative: a shared key must never be
   * removed, even at the cost of occasionally leaving an orphan behind).
   */
  private async computeDeletableUserOnlyKeys(
    userId: string,
    householdId: string,
    checks: Array<{ id: string; photoKeys: string[] }>,
  ): Promise<string[]> {
    const ownKeys = new Set<string>();
    for (const check of checks) {
      for (const key of check.photoKeys) {
        ownKeys.add(key);
      }
    }

    if (ownKeys.size === 0) {
      return [];
    }

    const pets = await this.prisma.pet.findMany({ where: { householdId }, select: { id: true, photoKey: true } });
    const petIds = pets.map((pet) => pet.id);

    const healthLogs = await this.prisma.healthLog.findMany({
      where: { petId: { in: petIds } },
      select: { photoKeys: true },
    });

    const otherChecks = await this.prisma.symptomCheck.findMany({
      where: { petId: { in: petIds }, createdById: { not: userId } },
      select: { photoKeys: true },
    });

    const referenced = new Set<string>();
    for (const pet of pets) {
      if (pet.photoKey !== null) {
        referenced.add(pet.photoKey);
      }
    }
    for (const log of healthLogs) {
      for (const key of log.photoKeys) {
        referenced.add(key);
      }
    }
    for (const other of otherChecks) {
      for (const key of other.photoKeys) {
        referenced.add(key);
      }
    }

    const deletable: string[] = [];
    for (const key of ownKeys) {
      const group = [key, deriveMainKey(key), deriveThumbKey(key)];
      const isShared = group.some((candidate) => referenced.has(candidate));
      if (!isShared) {
        deletable.push(...group);
      }
    }

    return deletable;
  }

  /**
   * D3: `AiAuditLog` rows are collected by id BEFORE the checks/threads they
   * reference are removed (no FK exists -- ids are the only link) and hard
   * -deleted (not tombstoned) -- see the model's own doc comment.
   */
  private async deleteAuditLogs(checkIds: string[], threadIds: string[]): Promise<number> {
    const byCheck = await this.prisma.aiAuditLog.deleteMany({ where: { checkId: { in: checkIds } } });
    const byThread = await this.prisma.aiAuditLog.deleteMany({ where: { threadId: { in: threadIds } } });
    return byCheck.count + byThread.count;
  }

  /**
   * Plan step 16: deterministic per-user quota counters for every metric x
   * window pair. Fully covers the persistent `total` lifetime keys (no TTL);
   * `day`/`month` leftovers self-expire (<=48h/<=40d) even if left behind.
   */
  private async deleteQuotaCounters(userId: string): Promise<void> {
    const now = new Date();
    const keys = QUOTA_METRICS.flatMap((metric) =>
      QUOTA_WINDOWS.map((window) => quotaKey(metric, window, userId, now)),
    );
    await this.redis.del(...keys);
  }

  private async deleteS3Keys(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.storage.deleteObjects(keys);
  }
}
