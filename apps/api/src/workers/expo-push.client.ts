import { Injectable } from "@nestjs/common";
import { Expo } from "expo-server-sdk";

/**
 * The ONLY file that imports `expo-server-sdk` (T057 plan decision 1). The
 * `ExpoPushClient` port normalizes SDK tickets/receipts into these tiny local
 * shapes so `PushSenderService` never imports SDK types and unit tests mock a
 * 3-method interface ("mocked Expo SDK") -- no real Expo call is ever made in
 * tests.
 */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string;
}

export interface PushTicket {
  status: "ok" | "error";
  id?: string;
  errorCode?: string;
}

export interface PushReceipt {
  status: "ok" | "error";
  errorCode?: string;
}

export interface ExpoPushClient {
  isValidToken(token: string): boolean;
  sendChunk(messages: PushMessage[]): Promise<PushTicket[]>;
  getReceipts(ticketIds: string[]): Promise<Map<string, PushReceipt>>;
}

export const EXPO_PUSH_CLIENT = Symbol("EXPO_PUSH_CLIENT");

/**
 * Concrete adapter over the official `expo-server-sdk`. Chunking-at-100,
 * collapse, and pruning all stay in `PushSenderService` -- this class only
 * transports already-chunked messages and normalizes the SDK's ticket/receipt
 * shapes (plan decision 1). No `EXPO_ACCESS_TOKEN` is wired (plan "Out of
 * scope" / Risk 6) -- `new Expo()` runs unauthenticated.
 */
@Injectable()
export class SdkExpoPushClient implements ExpoPushClient {
  private readonly expo = new Expo();

  isValidToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async sendChunk(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets = await this.expo.sendPushNotificationsAsync(messages);
    return tickets.map((ticket) =>
      ticket.status === "ok"
        ? { status: "ok", id: ticket.id }
        : { status: "error", errorCode: ticket.details?.error ?? "unknown_error" },
    );
  }

  async getReceipts(ticketIds: string[]): Promise<Map<string, PushReceipt>> {
    const result = new Map<string, PushReceipt>();
    const chunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);
    for (const chunk of chunks) {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
      for (const [id, receipt] of Object.entries(receipts)) {
        result.set(
          id,
          receipt.status === "ok"
            ? { status: "ok" }
            : { status: "error", errorCode: receipt.details?.error ?? "unknown_error" },
        );
      }
    }
    return result;
  }
}
