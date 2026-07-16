import { Injectable, Logger } from "@nestjs/common";
import { rcWebhookEnvelopeSchema } from "@pawcareright/types";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { computeSubscriptionUpdate } from "./rc-webhook.state";

type PrismaTx = Prisma.TransactionClient;

/**
 * T073 plan §"Interfaces/contracts": handles a raw RevenueCat webhook body.
 * Always acks `{ received: true }` on every HANDLED outcome (duplicate
 * replay, unresolved household/member, unknown event type, stale event, or
 * a successful upsert) -- only a genuine infra error is left to throw
 * (-> 500 -> RC retries). Logs are ids-only: never the token, never the
 * raw payload body.
 */
@Injectable()
export class RcWebhookService {
  private readonly logger = new Logger(RcWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(rawBody: unknown): Promise<{ received: true }> {
    const parsed = rcWebhookEnvelopeSchema.safeParse(rawBody);

    if (!parsed.success) {
      this.logger.warn("RC webhook payload failed schema validation; acking without processing.");
      return { received: true };
    }

    const { event } = parsed.data;
    const receivedNow = new Date();

    await this.prisma.$transaction(async (tx) => {
      const isDuplicate = await this.recordEventOrDetectDuplicate(tx, event.id);

      if (isDuplicate) {
        this.logger.log(`RC webhook event id=${event.id}: duplicate, replay no-op.`);
        return;
      }

      const existing = event.app_user_id
        ? await tx.subscription.findUnique({ where: { rcAppUserId: event.app_user_id } })
        : null;

      const result = computeSubscriptionUpdate(
        event,
        existing ? { lastEventAt: existing.lastEventAt } : null,
        receivedNow,
      );

      if (result.action === "skip") {
        this.logger.log(`RC webhook event id=${event.id}: skipped (${result.reason}).`);
        return;
      }

      const householdId = await this.resolveHouseholdId(tx, event.app_user_id, existing);

      if (!event.app_user_id || householdId === null) {
        this.logger.log(`RC webhook event id=${event.id}: no resolvable member/household, ack without write.`);
        return;
      }

      await tx.subscription.upsert({
        where: { rcAppUserId: event.app_user_id },
        create: {
          rcAppUserId: event.app_user_id,
          householdId,
          ...result.data,
          rawEventJson: rawBody as Prisma.InputJsonValue,
        },
        update: {
          householdId,
          ...result.data,
          rawEventJson: rawBody as Prisma.InputJsonValue,
        },
      });
    });

    return { received: true };
  }

  /**
   * Dedupe (plan decision 2/3): the `ProcessedWebhookEvent` PK insert
   * inside the same transaction as the subscription upsert. A `P2002`
   * unique-constraint violation means this `eventId` was already handled
   * -- treated as a replay no-op, not an error.
   */
  private async recordEventOrDetectDuplicate(tx: PrismaTx, eventId: string): Promise<boolean> {
    try {
      await tx.processedWebhookEvent.create({ data: { eventId } });
      return false;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        return true;
      }
      throw error;
    }
  }

  /**
   * Plan decisions 5/6: household resolved from the purchaser's CURRENT
   * membership (v1 = one household per user), re-stamped at write time.
   * Falls back to an existing row's `householdId` only when no current
   * membership resolves; returns `null` (no upsert, no FK 500) when
   * neither exists -- e.g. an anonymous/unknown `app_user_id`.
   */
  private async resolveHouseholdId(
    tx: PrismaTx,
    rcAppUserId: string | undefined,
    existing: { householdId: string } | null,
  ): Promise<string | null> {
    if (rcAppUserId) {
      const membership = await tx.membership.findFirst({ where: { userId: rcAppUserId } });
      if (membership) {
        return membership.householdId;
      }
    }

    return existing?.householdId ?? null;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
