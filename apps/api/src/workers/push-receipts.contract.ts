/**
 * Single source of truth for the push-receipt-check BullMQ queue name and job
 * payload shape (T057), shared by the producer (`PushSenderService.sendForEvent`)
 * and the consumer (`PushReceiptsProcessor`). Mirrors `push.contract.ts`. The
 * payload carries only the ticket ids and the device each ticket targets --
 * no token, no reminder title/type (plan Safety statement).
 */
export const PUSH_RECEIPTS_QUEUE = "pawcareright-push-receipts";

export const PUSH_RECEIPT_JOB_NAME = "push-receipt-check";

export const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;

export interface PushReceiptJobData {
  tickets: Array<{ ticketId: string; deviceId: string }>;
}
