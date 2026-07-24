import { z } from "zod";

import { symptomCategorySchema } from "./intake";

/**
 * Chat API schemas (T081 — F7 "Ask Paw Care Right +"): thread creation, the
 * outbound message request, and the four pinned SSE event payload shapes.
 * These are the single Zod source of truth (CLAUDE §6) — api validates with
 * them, client infers types from them.
 */

export const CHAT_SSE_EVENTS = ["start", "nudge", "chunk", "done"] as const;
export const chatSseEventSchema = z.enum(CHAT_SSE_EVENTS);
export type ChatSseEvent = z.infer<typeof chatSseEventSchema>;

export const chatMessageRoles = ["USER", "ASSISTANT"] as const;
export const chatMessageRoleSchema = z.enum(chatMessageRoles);
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

export const chatMessageStatuses = ["OK", "SAFE_FALLBACK"] as const;
export const chatMessageStatusSchema = z.enum(chatMessageStatuses);
export type ChatMessageStatus = z.infer<typeof chatMessageStatusSchema>;

export const CHAT_MESSAGE_MAX_CHARS = 2000;

/** SPEC §7 fair-use: Premium chat messages, 200/month. */
export const CHAT_FAIR_USE_MONTHLY_LIMIT = 200;

export const createChatThreadRequestSchema = z.object({
  petId: z.string().uuid(),
});
export type CreateChatThreadRequest = z.infer<typeof createChatThreadRequestSchema>;

export const chatThreadSchema = z.object({
  id: z.string(),
  petId: z.string(),
  createdAt: z.string(),
});
export type ChatThread = z.infer<typeof chatThreadSchema>;

export const sendChatMessageRequestSchema = z.object({
  content: z.string().min(1).max(CHAT_MESSAGE_MAX_CHARS),
});
export type SendChatMessageRequest = z.infer<typeof sendChatMessageRequestSchema>;

export const chatStartEventSchema = z.object({
  threadId: z.string(),
  userMessageId: z.string(),
  assistantMessageId: z.string(),
});
export type ChatStartEvent = z.infer<typeof chatStartEventSchema>;

export const chatNudgeEventSchema = z.object({
  category: symptomCategorySchema,
});
export type ChatNudgeEvent = z.infer<typeof chatNudgeEventSchema>;

export const chatChunkEventSchema = z.object({
  seq: z.number().int().min(0),
  text: z.string(),
});
export type ChatChunkEvent = z.infer<typeof chatChunkEventSchema>;

export const chatQuotaSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().min(0),
  remaining: z.number().int().min(0),
});
export type ChatQuota = z.infer<typeof chatQuotaSchema>;

export const chatDoneEventSchema = z.object({
  assistantMessageId: z.string(),
  status: chatMessageStatusSchema,
  quota: chatQuotaSchema,
});
export type ChatDoneEvent = z.infer<typeof chatDoneEventSchema>;
