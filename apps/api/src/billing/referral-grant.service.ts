import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { computeGrantWindow, isGrantCapReached, type ReferralGrantRow } from "./referral-grant.util";

type PrismaTx = Prisma.TransactionClient;

export interface IssueForAcceptedInviteParams {
  inviteId: string;
  joinerUserId: string;
  inviterUserId: string;
}

/**
 * T108 plan D7/D8, FIX ROUND (checker `loop/reviews/T108.review.md` F1/F2):
 *
 * **F1 resolution — issuance runs in its OWN transaction, called AFTER the
 * invite-accept transaction has already committed** (`households.service.ts`
 * calls this outside `$transaction`, in a try/catch that logs and swallows
 * any error). This makes D6's "an abuse guard must never fail a household
 * join" LITERALLY true rather than merely "practically unreachable": no
 * error from this service -- P2002, an infra blip, anything -- can ever roll
 * back a join that has already committed, because the join's transaction is
 * already done by the time this method is even called. Idempotency is still
 * `@@unique([inviteId, userId])` (D8) plus this being called at most once
 * per successful accept (the invite's own single-use claim guarantees that).
 *
 * **F2 resolution — per-recipient Postgres advisory locks make the
 * read-then-insert cap check and the chain-tip math race-free.** Without a
 * lock, two concurrent accepts crediting the SAME recipient (e.g. one user
 * invites two others, who accept concurrently) could each read the same
 * `existing` grant history, both pass the cap check, and both insert --
 * over-crediting the cap and losing the chain (both windows starting at the
 * same `now` instead of stacking). `pg_advisory_xact_lock(hashtext(id))` is
 * taken for BOTH recipients, in a DETERMINISTIC (sorted) order, inside one
 * transaction, before either recipient's cap check runs -- sorted order
 * prevents a lock-order deadlock between two concurrent MUTUAL accepts (A
 * invites B while B invites A at the same instant would otherwise lock
 * {A then B} in one transaction and {B then A} in the other). The lock is a
 * `pg_advisory_xact_lock` (transaction-scoped): it is released automatically
 * when this method's own transaction commits or rolls back, so no explicit
 * unlock call is needed and a crash can never leave it held.
 *
 * This is the ONLY writer of `ReferralGrant`; it never reads, writes, or
 * references `Subscription` (AC "RC entitlement unaffected").
 */
@Injectable()
export class ReferralGrantService {
  private readonly logger = new Logger(ReferralGrantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async issueForAcceptedInvite(params: IssueForAcceptedInviteParams, now: Date = new Date()): Promise<void> {
    const { inviteId, joinerUserId, inviterUserId } = params;

    if (joinerUserId === inviterUserId) {
      // Defensive: `HouseholdsService.acceptInvite`'s self-accept guard
      // already blocks this before its transaction opens, so this branch is
      // unreachable in production -- kept as a belt-and-braces no-op so this
      // service can never double-grant a single identity off one accept.
      return;
    }

    const counterpartyOf = new Map<string, string>([
      [joinerUserId, inviterUserId],
      [inviterUserId, joinerUserId],
    ]);
    // F2: sorted (deterministic) lock order -- see class doc comment.
    const lockOrder = [joinerUserId, inviterUserId].sort();

    await this.prisma.$transaction(async (tx) => {
      for (const recipient of lockOrder) {
        await this.acquireAdvisoryLock(tx, recipient);
      }
      for (const recipient of lockOrder) {
        const counterparty = counterpartyOf.get(recipient);
        /* istanbul ignore next -- `counterpartyOf` is built from exactly these two ids. */
        if (counterparty === undefined) {
          continue;
        }
        await this.issueOne(tx, { recipient, counterparty, inviteId, now });
      }
    });
  }

  /**
   * F2: transaction-scoped advisory lock keyed on the recipient's user id,
   * hashed to a bigint (the standard `hashtext(...)::bigint` idiom -- avoids
   * a second lookup table or a UUID->int cast). Held for the lifetime of the
   * surrounding `$transaction`; Postgres releases it automatically on commit
   * or rollback.
   */
  private async acquireAdvisoryLock(tx: PrismaTx, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`;
  }

  private async issueOne(
    tx: PrismaTx,
    args: { recipient: string; counterparty: string; inviteId: string; now: Date },
  ): Promise<void> {
    const { recipient, counterparty, inviteId, now } = args;

    // F2: race-free under the advisory lock acquired above -- no concurrent
    // caller can read this recipient's grant history until this whole
    // transaction (both the cap check AND the insert below) has committed.
    const existing: ReferralGrantRow[] = await tx.referralGrant.findMany({
      where: { userId: recipient },
      select: { startsAt: true, expiresAt: true },
    });

    if (isGrantCapReached(existing.length)) {
      this.logger.log({ event: "referral_grant_cap_skipped", userId: recipient, inviteId });
      return;
    }

    const window = computeGrantWindow(existing, now);

    // F1 fix round: NO try/catch swallow here. Under the advisory lock, a
    // `P2002` on `@@unique([inviteId, userId])` cannot occur in practice --
    // the lock serializes every concurrent writer for this recipient, and
    // the invite's own single-use claim guarantees this method is called at
    // most once per invite. If a collision somehow still occurred, letting
    // it propagate is the honest behaviour: it aborts only THIS (already
    // post-commit, standalone) transaction, and is caught, logged, and
    // swallowed by the caller (`HouseholdsService.acceptInvite`'s try/catch
    // around this call) -- never a fake silent swallow at this layer, and
    // never a rolled-back join (the join committed before this ran).
    await tx.referralGrant.create({
      data: {
        userId: recipient,
        counterpartyUserId: counterparty,
        inviteId,
        startsAt: window.startsAt,
        expiresAt: window.expiresAt,
      },
    });
  }
}
