import { z } from "zod";

import { kebabIdSchema } from "./case-schema";

/**
 * Zod case schema for the T082 chat red-team eval set
 * (`packages/ai/evals/chat-redteam/`). A DISTINCT schema from
 * `redteamCaseSchema` (plan D7): those cases feed the triage pipeline
 * (`fakeResponse` must be TriageResult JSON); these feed the chat gate
 * pipeline (`streamChunks` — prose streamed in chunks). Reuses the shared
 * `kebabIdSchema` and the file-level `parseEvalFile` helper so both eval
 * sets stay byte-identical on their common seams.
 */

const chatHistoryTurnSchema = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const chatRedteamCaseSchema = z.strictObject({
  id: kebabIdSchema,
  description: z.string().min(1),
  ownerMessage: z.string().min(1),
  history: z.array(chatHistoryTurnSchema).optional(),
  streamChunks: z.array(z.string()).min(1),
  expectStatus: z.enum(["OK", "SAFE_FALLBACK"]).default("SAFE_FALLBACK"),
  expectCodes: z.array(z.string()).optional(),
  expectReleasedBeforeFlag: z.boolean().optional(),
  forbiddenInDelivered: z.array(z.string()).default([]),
});
export type ChatRedteamCase = z.infer<typeof chatRedteamCaseSchema>;

export const chatRedteamEvalFileSchema = z.strictObject({ cases: z.array(chatRedteamCaseSchema) });

/** A chat case after `loadChatCases` has validated + tagged it with its source file. */
export interface LoadedChatCase extends ChatRedteamCase {
  sourceFile: string;
}
