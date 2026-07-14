import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_DISPLAY_NAME } from "@pawcareright/config";
import type { Queue } from "bullmq";

import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { EXPO_PUSH_CLIENT, type ExpoPushClient, type PushMessage, type PushTicket } from "./expo-push.client";
import {
  PUSH_RECEIPT_JOB_NAME,
  PUSH_RECEIPTS_QUEUE,
  RECEIPT_CHECK_DELAY_MS,
  type PushReceiptJobData,
} from "./push-receipts.contract";
import { PUSH_JOB_NAME, PUSH_QUEUE, type PushJobData } from "./push.contract";
import { computeDeferUntil } from "./quiet-hours";

/** Expo's per-request send limit; also our collapse-group chunk size (plan decision 1). */
export const EXPO_PUSH_CHUNK_SIZE = 100;

/** TTL for the per-(user,minute) collapse claim (plan "Collapse spec"). */
export const COLLAPSE_CLAIM_TTL_SECONDS = 3600;

/**
 * Redis key for the per-user, per-due-minute collapse claim (plan "Collapse
 * spec", CLAUDE §1a Redis prefix).
 */
export function collapseKey(userId: string, minuteEpoch: number): string {
  return `pawcareright:push:collapse:${userId}:${minuteEpoch}`;
}

/**
 * Pinned push body copy (plan Safety statement / "Collapse spec") -- exactly
 * two forms, never medical advice, never a dose. `singleTitle` is the user's
 * own reminder title (used only when `count === 1`).
 */
export function buildReminderPushBody(input: { count: number; singleTitle: string }): string {
  return input.count >= 2 ? `${input.count} care reminders due` : `Care reminder: ${input.singleTitle}`;
}

interface OutgoingMessage {
  message: PushMessage;
  deviceId: string;
}

/**
 * `PushSenderService` (T057): consumes T056's `pawcareright-push` jobs.
 * `sendForEvent` loads the event read-only (no `reminderEvent` write --
 * plan decision 3), collapses same-user same-minute events into one push via
 * an atomic Redis `SETNX` claim (plan "Collapse spec"), batches sends in
 * chunks of `EXPO_PUSH_CHUNK_SIZE` with per-chunk isolation, prunes devices
 * whose ticket is `DeviceNotRegistered` immediately, and defers other
 * tickets to a delayed `pawcareright-push-receipts` job. `checkReceipts`
 * polls that job's tickets and prunes on a `DeviceNotRegistered` receipt.
 * Never logs `expoPushToken`/reminder `title`/`type`/`medNameAsEntered` --
 * every log object is id/count-keyed only (plan Safety statement).
 */
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EXPO_PUSH_CLIENT) private readonly expoClient: ExpoPushClient,
    private readonly redis: RedisService,
    @InjectQueue(PUSH_RECEIPTS_QUEUE) private readonly receiptsQueue: Queue<PushReceiptJobData>,
    @InjectQueue(PUSH_QUEUE) private readonly pushQueue: Queue<PushJobData>,
  ) {}

  /**
   * `targetUserId` (T058 checker fix): set ONLY when this call is the
   * window-end re-run of a quiet-hours deferred job
   * (`push.processor.ts` <- `PushJobData.userId`). When present, ONLY that
   * one household member is (re)processed -- every other co-household
   * member, already handled in the original run, is skipped entirely. This
   * prevents the deferred re-run from re-notifying members who were never
   * deferred (BLOCKING checker finding: without this, a household with one
   * quiet-houred member and one non-quiet member would double-push the
   * non-quiet member). The targeted user still goes through the same
   * type-off / quiet-window re-check (so it re-defers again if still
   * inside the window) and its own collapse claim, unchanged.
   */
  async sendForEvent(reminderEventId: string, targetUserId?: string): Promise<void> {
    // Captured once so a single instant drives both the quiet-hours
    // in-window test and the deferred job's `delay` (plan "Defer semantics").
    const now = new Date();

    const event = await this.prisma.reminderEvent.findUnique({
      where: { id: reminderEventId },
      include: {
        reminder: {
          include: {
            pet: {
              include: {
                household: {
                  include: {
                    memberships: { select: { userId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (event === null) {
      // Redelivered job for a deleted row -- ack, nothing to do.
      this.logger.log({ event: "push_event_missing", reminderEventId });
      return;
    }

    if (event.status !== "SENT") {
      // Already DONE/SNOOZED/MISSED in the gap -- naturally excluded.
      this.logger.log({ event: "push_event_not_eligible", reminderEventId, status: event.status });
      return;
    }

    const minuteEpoch = Math.floor(event.dueAt.getTime() / 60_000);
    const minuteStart = new Date(minuteEpoch * 60_000);
    const minuteEnd = new Date((minuteEpoch + 1) * 60_000);

    const allRecipientUserIds = Array.from(new Set(event.reminder.pet.household.memberships.map((m) => m.userId)));
    // A targeted deferred re-run only ever touches its own user -- never
    // the rest of the household (plan Decision-2 "no path double-pushes a
    // user"; T058 checker fix).
    const recipientUserIds =
      targetUserId !== undefined ? allRecipientUserIds.filter((id) => id === targetUserId) : allRecipientUserIds;

    const outgoing: OutgoingMessage[] = [];

    for (const userId of recipientUserIds) {
      const prefsRow = await this.prisma.userNotificationPrefs.findUnique({ where: { userId } });
      const disabledTypes = prefsRow?.disabledTypes ?? [];
      const deferUntil = computeDeferUntil(
        {
          quietStart: prefsRow?.quietStart ?? null,
          quietEnd: prefsRow?.quietEnd ?? null,
          timezone: prefsRow?.timezone ?? null,
        },
        now,
      );

      if (deferUntil !== null) {
        // Never take the collapse claim while deferred -- the deferred job
        // re-runs `sendForEvent` at window-end, where `computeDeferUntil`
        // returns null and collapse proceeds normally (plan decision 2).
        // `userId` is carried on the payload (T058 checker fix) so the
        // window-end re-run targets ONLY this user, never the rest of the
        // household.
        const windowEndMinuteEpoch = Math.floor(deferUntil.getTime() / 60_000);
        await this.pushQueue.add(
          PUSH_JOB_NAME,
          { reminderEventId: event.id, userId },
          {
            jobId: `${event.id}:defer:${userId}:${windowEndMinuteEpoch}`,
            delay: deferUntil.getTime() - now.getTime(),
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.log({ event: "push_deferred", reminderEventId: event.id, userId, windowEndMinuteEpoch });
        continue;
      }

      const key = collapseKey(userId, minuteEpoch);
      const won = await this.redis.setNx(key, event.id, COLLAPSE_CLAIM_TTL_SECONDS);
      if (!won) {
        const owner = await this.redis.get(key);
        if (owner !== event.id) {
          // Another event already owns the collapse for this user+minute.
          continue;
        }
        // owner === event.id: this is a retry of the winner -- re-enter.
      }

      const group = await this.prisma.reminderEvent.findMany({
        where: {
          status: "SENT",
          dueAt: { gte: minuteStart, lt: minuteEnd },
          reminder: { pet: { household: { memberships: { some: { userId } } } } },
        },
        include: { reminder: { select: { title: true, type: true } } },
      });
      const enabledGroup = group.filter((g) => !disabledTypes.includes(g.reminder.type));
      const count = enabledGroup.length;

      if (count === 0) {
        // Every due event for this user+minute is for a disabled type --
        // suppress with zero side effects (no device fetch, no send, no
        // prune, no defer).
        this.logger.log({ event: "push_type_suppressed", reminderEventId: event.id, userId });
        continue;
      }

      const singleTitle = enabledGroup[0]?.reminder.title ?? "";

      const devices = await this.prisma.device.findMany({
        where: { userId },
        select: { id: true, expoPushToken: true },
      });

      let invalidCount = 0;
      for (const device of devices) {
        if (!this.expoClient.isValidToken(device.expoPushToken)) {
          invalidCount += 1;
          continue;
        }
        outgoing.push({
          message: {
            to: device.expoPushToken,
            title: APP_DISPLAY_NAME,
            body: buildReminderPushBody({ count, singleTitle }),
            data: { reminderEventId: event.id, count, kind: "reminder" },
            sound: "default",
          },
          deviceId: device.id,
        });
      }
      if (invalidCount > 0) {
        this.logger.warn({ event: "push_invalid_token_skipped", userId, invalidCount });
      }
    }

    if (outgoing.length === 0) {
      return;
    }

    const chunks: OutgoingMessage[][] = [];
    for (let i = 0; i < outgoing.length; i += EXPO_PUSH_CHUNK_SIZE) {
      chunks.push(outgoing.slice(i, i + EXPO_PUSH_CHUNK_SIZE));
    }

    let hadTransientError = false;
    const prune = new Set<string>();
    const receiptTargets: Array<{ ticketId: string; deviceId: string }> = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex]!;
      let tickets: PushTicket[];
      try {
        tickets = await this.expoClient.sendChunk(chunk.map((x) => x.message));
      } catch {
        this.logger.warn({ event: "push_chunk_failed", chunkIndex });
        hadTransientError = true;
        continue;
      }

      for (let i = 0; i < tickets.length; i += 1) {
        const ticket = tickets[i]!;
        const deviceId = chunk[i]!.deviceId;
        if (ticket.status === "error" && ticket.errorCode === "DeviceNotRegistered") {
          prune.add(deviceId);
        } else if (ticket.status === "error") {
          this.logger.warn({ event: "push_ticket_error", deviceId, errorCode: ticket.errorCode });
        } else if (ticket.status === "ok" && ticket.id !== undefined) {
          receiptTargets.push({ ticketId: ticket.id, deviceId });
        }
      }
    }

    if (prune.size > 0) {
      await this.prisma.device.deleteMany({ where: { id: { in: [...prune] } } });
      this.logger.log({ event: "push_device_pruned", count: prune.size });
    }

    if (receiptTargets.length > 0) {
      try {
        await this.receiptsQueue.add(
          PUSH_RECEIPT_JOB_NAME,
          { tickets: receiptTargets },
          {
            jobId: `receipt:${event.id}`,
            delay: RECEIPT_CHECK_DELAY_MS,
            attempts: 3,
            backoff: { type: "exponential", delay: 60_000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      } catch {
        // Best-effort: a queue failure never fails the (already-sent) push.
        this.logger.warn({ event: "push_receipt_enqueue_failed", reminderEventId: event.id });
      }
    }

    this.logger.log({
      event: "push_sent",
      reminderEventId: event.id,
      recipientCount: recipientUserIds.length,
      messageCount: outgoing.length,
      chunkCount: chunks.length,
      prunedCount: prune.size,
      receiptCount: receiptTargets.length,
    });

    if (hadTransientError) {
      // All chunks were attempted (per-chunk isolation) -- now let BullMQ
      // retry the whole job (plan decision 5 / Risk 4).
      throw new Error("expo_send_transient_failure");
    }
  }

  async checkReceipts(tickets: Array<{ ticketId: string; deviceId: string }>): Promise<void> {
    const receipts = await this.expoClient.getReceipts(tickets.map((t) => t.ticketId));

    const prune = new Set<string>();
    for (const { ticketId, deviceId } of tickets) {
      const receipt = receipts.get(ticketId);
      if (receipt === undefined) {
        // Not ready yet -- a later attempt/job may re-poll (not persisted, accepted).
        this.logger.debug({ event: "push_receipt_not_ready", deviceId });
        continue;
      }
      if (receipt.status === "error" && receipt.errorCode === "DeviceNotRegistered") {
        prune.add(deviceId);
      } else if (receipt.status === "error") {
        this.logger.warn({ event: "push_receipt_error", deviceId, errorCode: receipt.errorCode });
      }
    }

    if (prune.size > 0) {
      await this.prisma.device.deleteMany({ where: { id: { in: [...prune] } } });
      this.logger.log({ event: "push_receipt_pruned", count: prune.size });
    }
  }
}
