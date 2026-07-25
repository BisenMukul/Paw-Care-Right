import { randomUUID } from "node:crypto";

import { HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  buildChatPrompt,
  detectSymptomNudge,
  runGatedStream,
  SAFE_FALLBACK_CHAT_MESSAGE,
  type ChatPetContext,
  type ChatSafetyIncident,
  type ChatTurn,
  type TextGenerateOptions,
  type TextProvider,
  type TextStreamChunk,
  type TimelineDigestInput,
} from "@pawcareright/ai";
import type { ChatMessageStatus, SymptomCategory, Urgency } from "@pawcareright/types";
import type { ChatMessage as PrismaChatMessage } from "@prisma/client";

import { AiAuditService } from "../audit/ai-audit.service";
import { buildChatDetectorFlags } from "../audit/ai-audit.flags";
import { PetsService } from "../pets/pets.service";
import { PrismaService } from "../prisma/prisma.service";
import { ENTITLEMENT_RESOLVER, type EntitlementResolver } from "../quota/entitlement";
import { CostLogService } from "../quota/cost-log.service";
import { QuotaService } from "../quota/quota.service";
import { CHAT_DIGEST_WINDOW_DAYS, CHAT_HISTORY_TURNS, CHAT_STREAM_TIMEOUT_MS } from "./chat.constants";
import { CHAT_TEXT_MODEL_ID, CHAT_TEXT_PROVIDER } from "./chat.tokens";
import type { CreateThreadDto } from "./dto/create-thread.dto";
import type { SendMessageDto } from "./dto/send-message.dto";
import { SseWriter } from "./sse-writer";

const MS_PER_DAY = 86_400_000;

/** `POST /chat/threads` response shape (T081 — mirrors `packages/types`' `chatThreadSchema`). */
export interface ChatThreadResponse {
  id: string;
  petId: string;
  createdAt: string;
}

interface FinalizeStreamOptions {
  assistantMessageId: string;
  threadId: string;
  userId: string;
  aborted: boolean;
  status: ChatMessageStatus;
  content: string;
  nudgeCategory: SymptomCategory | undefined;
  promptVersion: string;
  detectorFlags: string[];
  quotaResult: { used: number; limit: number | null; remaining: number | null };
  sse: SseWriter;
}

/**
 * `POST /chat/threads` + `POST /chat/threads/:id/messages` business logic
 * (T081 — F7 "Ask Paw Care Right +"; T082 hardens the output gate). The
 * message-send flow's step order is PRODUCT_SPEC §5-critical (plan
 * "Endpoint specs"): 404 thread -> 402 feature-lock -> 402 quota -> persist
 * USER row -> deterministic pre-AI nudge -> build prompt -> write SSE
 * headers -> stream through the SHARED, overlap-scanned
 * `@pawcareright/ai` output gate (`runGatedStream`) -> persist ASSISTANT
 * row -> `done`. Every failure mode (detector finding, provider
 * error/timeout, empty completion, client disconnect) converges on the SAME
 * fail-upward `SAFE_FALLBACK` path — no silent retry, no bare `error` event.
 * Nest `Logger` only; never logs message content — a `chat_safety_incident`
 * carries finding CODES only (T082 D3).
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly petsService: PetsService,
    private readonly quotaService: QuotaService,
    private readonly costLog: CostLogService,
    @Inject(ENTITLEMENT_RESOLVER) private readonly entitlementResolver: EntitlementResolver,
    @Inject(CHAT_TEXT_PROVIDER) private readonly textProvider: TextProvider,
    @Inject(CHAT_TEXT_MODEL_ID) private readonly textModelId: string,
    private readonly aiAudit: AiAuditService,
  ) {}

  async createThread(householdId: string, userId: string, dto: CreateThreadDto): Promise<ChatThreadResponse> {
    // 1. Pet must exist in the caller's household — 404, never a leak.
    await this.petsService.findOne(householdId, dto.petId);

    // 2. Feature lock — chat is premium-only (D7). No quota consumed here:
    // threads are free to open for premium users, only messages are metered.
    const entitlement = await this.entitlementResolver.resolve(userId, householdId);
    if (entitlement.tier === "FREE") {
      throw new HttpException("Ask Paw Care Right + is a premium feature.", HttpStatus.PAYMENT_REQUIRED);
    }

    const thread = await this.prisma.chatThread.create({
      data: { petId: dto.petId, createdById: userId },
    });

    return { id: thread.id, petId: thread.petId, createdAt: thread.createdAt.toISOString() };
  }

  /**
   * Streams the assistant's answer over `sse`. Every rejection that can
   * still produce the standard JSON error envelope (404/400/402) is thrown
   * BEFORE `sse.writeHead` is ever called (plan decision D2/R9) — nothing
   * after that point may throw out of this method.
   */
  async streamMessage(
    householdId: string,
    userId: string,
    threadId: string,
    dto: SendMessageDto,
    sse: SseWriter,
  ): Promise<void> {
    // 1. Household-scoped thread resolution — 404, never a leak. JSON error, no SSE headers yet.
    const thread = await this.prisma.chatThread.findFirst({
      where: { id: threadId, pet: { householdId, deletedAt: null } },
      include: { pet: true },
    });
    if (!thread) {
      throw new NotFoundException();
    }

    // 3. Feature lock. JSON error, no SSE headers yet.
    const entitlement = await this.entitlementResolver.resolve(userId, householdId);
    if (entitlement.tier === "FREE") {
      throw new HttpException("Ask Paw Care Right + is a premium feature.", HttpStatus.PAYMENT_REQUIRED);
    }

    // 4. Fair-use quota. JSON error, no SSE headers yet.
    const quotaResult = await this.quotaService.consume(userId, "chatMessages", entitlement);
    if (!quotaResult.allowed) {
      throw new HttpException("Monthly chat fair-use limit reached.", HttpStatus.PAYMENT_REQUIRED);
    }

    // 5. Persist the USER message — raw content as typed, capped by the DTO.
    const userMessage = await this.prisma.chatMessage.create({
      data: { threadId, role: "USER", content: dto.content },
    });

    // 6. Deterministic, pre-AI, code-only nudge detector.
    const nudge = detectSymptomNudge(dto.content);

    // 7. Build the prompt — pet context + the last CHAT_HISTORY_TURNS turns
    // + the 90-day digest (the ONE Date.now() read for this whole call).
    const now = new Date();
    const windowStart = new Date(now.getTime() - CHAT_DIGEST_WINDOW_DAYS * MS_PER_DAY);

    const [digest, history] = await Promise.all([
      this.gatherDigest(thread.petId, windowStart),
      this.gatherHistory(threadId, userMessage.id),
    ]);

    const petContext: ChatPetContext = {
      name: thread.pet.name,
      species: thread.pet.species,
      sex: thread.pet.sex,
      neutered: thread.pet.neutered,
      ...(thread.pet.ageEstimateMonths !== null ? { ageMonths: thread.pet.ageEstimateMonths } : {}),
      ...(thread.pet.weightGrams !== null ? { weightKg: thread.pet.weightGrams / 1000 } : {}),
    };

    const built = buildChatPrompt({ pet: petContext, digest, history, ownerMessage: dto.content });

    // 8. Write SSE headers + `start` (+ `nudge` if it fired) — the FIRST
    // point after which nothing may throw out of this method.
    const assistantMessageId = randomUUID();
    sse.writeHead({
      "X-Quota-Limit": String(quotaResult.limit ?? 0),
      "X-Quota-Remaining": String(quotaResult.remaining ?? 0),
    });
    sse.send("start", { threadId, userMessageId: userMessage.id, assistantMessageId });
    if (nudge) {
      sse.send("nudge", { category: nudge.category });
    }

    let aborted = false;
    const onClose = (): void => {
      aborted = true;
    };
    sse.onClose(onClose);

    // 9/10. Release-gated streaming through the SHARED `@pawcareright/ai`
    // output gate (T082 D1/F3 fix) — every finding/error/timeout/empty
    // completion converges on the same SAFE_FALLBACK path.
    const options: TextGenerateOptions = {
      system: built.system,
      messages: built.messages,
      temperature: built.temperature,
      timeoutMs: CHAT_STREAM_TIMEOUT_MS,
    };

    let seq = 0;
    let delivered = "";

    const emitChunk = (text: string): void => {
      delivered += text;
      sse.send("chunk", { seq, text });
      seq += 1;
    };

    const result = await runGatedStream(this.streamDeltas(options), { emit: emitChunk, shouldAbort: () => aborted });
    if (result.incident) {
      this.logSafetyIncident(threadId, result.incident, result.providerErrorMessage);
    }
    const status = result.status;
    const detectorFlags = buildChatDetectorFlags(result.incident ?? undefined);

    if (!aborted && status === "SAFE_FALLBACK") {
      emitChunk(SAFE_FALLBACK_CHAT_MESSAGE);
    }

    // 11/12. Persist the ASSISTANT message + log cost (never throws out of
    // this method, F1 fix), then emit `done` + end the stream — unless the
    // client already disconnected, in which case nothing more may be
    // written to the closed socket.
    await this.finalizeStream({
      assistantMessageId,
      threadId,
      userId,
      aborted,
      status,
      // D4: a SAFE_FALLBACK row persists ONLY the fallback sentence, never a
      // partially-released flagged prefix — so history replay (T083) and
      // `gatherHistory` prompt context can never redeliver/re-prompt it.
      content: status === "SAFE_FALLBACK" ? SAFE_FALLBACK_CHAT_MESSAGE : delivered,
      nudgeCategory: nudge?.category,
      promptVersion: built.version,
      detectorFlags,
      quotaResult,
      sse,
    });
  }

  /**
   * Content-free-by-construction incident log (T082 D3/Safety statement 5):
   * the gate hands this call site finding CODES only, never excerpts, never
   * the owner message, never model text — a careless log call physically
   * cannot leak message content. Not a DB row (D3): a structured `Logger`
   * record is enough for the operational need (alerting on the rate of
   * fallbacks) without a schema/migration/retention story nobody asked for.
   */
  private logSafetyIncident(threadId: string, incident: ChatSafetyIncident, providerErrorMessage?: string): void {
    this.logger.warn({
      event: "chat_safety_incident",
      threadId,
      reason: incident.reason,
      codes: incident.codes,
      phase: incident.phase,
      charsScanned: incident.charsScanned,
      releasedChars: incident.releasedChars,
      releasedBeforeFlag: incident.releasedBeforeFlag,
      status: "SAFE_FALLBACK",
      ...(providerErrorMessage !== undefined ? { error: providerErrorMessage } : {}),
    });
  }

  /**
   * Persists the ASSISTANT row + logs cost, wrapped so a post-header
   * infrastructure failure (DB down, cost-log I/O) can NEVER throw out of
   * `streamMessage` (T082 F1 — closes the T081 review finding): the `done`
   * frame is still emitted with the computed status even if persistence
   * failed. A client disconnect (`aborted`) still persists whatever was
   * actually delivered, but never writes to the closed socket.
   */
  private async finalizeStream(options: FinalizeStreamOptions): Promise<void> {
    const {
      assistantMessageId,
      threadId,
      userId,
      aborted,
      status,
      content,
      nudgeCategory,
      promptVersion,
      detectorFlags,
      quotaResult,
      sse,
    } = options;

    try {
      await this.persistAssistantMessage(assistantMessageId, threadId, content, status, nudgeCategory, promptVersion);
      await this.logCost(userId, status);
      // T090 plan step 17: placed inside this existing `try`, which already
      // converts any post-header failure into a logged `chat_persist_failed`
      // rather than a throw -- and `AiAuditService.record` itself never
      // throws (belt-and-braces), so `sse.send("done")`/`sse.end()` below
      // remain unconditionally reachable.
      await this.aiAudit.record({
        surface: "CHAT",
        threadId,
        promptVersion,
        modelId: this.textModelId,
        detectorFlags,
        costMicroUsd: 0,
        status,
      });
    } catch (error) {
      this.logger.error({
        event: "chat_persist_failed",
        threadId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (aborted) {
      // Client disconnected — never write to a closed socket.
      return;
    }

    sse.send("done", {
      assistantMessageId,
      status,
      quota: { used: quotaResult.used, limit: quotaResult.limit ?? 0, remaining: quotaResult.remaining ?? 0 },
    });
    sse.end();
  }

  /**
   * Uniform delta source (T081 plan decision D3): when the injected
   * provider implements `generateStream`, its deltas are used directly;
   * otherwise this degrades to one `generate()` call yielded as a single
   * delta, so the SAME release-gated consumption loop above produces a
   * correct, safe, single-chunk answer either way.
   */
  private async *streamDeltas(options: TextGenerateOptions): AsyncGenerator<TextStreamChunk> {
    if (typeof this.textProvider.generateStream === "function") {
      yield* this.textProvider.generateStream(options);
      return;
    }

    const result = await this.textProvider.generate(options);
    if (result.text.length > 0) {
      yield { text: result.text };
    }
  }

  private async gatherDigest(petId: string, windowStart: Date): Promise<TimelineDigestInput> {
    const [weightRows, noteRows, checkRows, medicationDoseCount] = await Promise.all([
      this.prisma.healthLog.findMany({
        where: { petId, kind: "WEIGHT", occurredAt: { gte: windowStart } },
        orderBy: { occurredAt: "asc" },
      }),
      this.prisma.healthLog.findMany({
        where: { petId, kind: "NOTE", occurredAt: { gte: windowStart } },
        orderBy: { occurredAt: "desc" },
      }),
      this.prisma.symptomCheck.findMany({
        where: { petId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "desc" },
        include: { result: true },
      }),
      this.prisma.reminderEvent.count({
        where: {
          status: "DONE",
          completedAt: { not: null, gte: windowStart },
          reminder: { petId, type: "MEDICATION" },
        },
      }),
    ]);

    return {
      weights: weightRows.flatMap((row) => {
        const value = row.valueJson as { weightGrams?: number };
        return typeof value.weightGrams === "number" ? [{ occurredAt: row.occurredAt, grams: value.weightGrams }] : [];
      }),
      checks: checkRows.map((check) => ({
        createdAt: check.createdAt,
        tier: (check.result?.urgency as Urgency | undefined) ?? null,
      })),
      notes: noteRows.flatMap((row) => {
        const value = row.valueJson as { text?: string };
        return typeof value.text === "string" ? [{ occurredAt: row.occurredAt, text: value.text }] : [];
      }),
      medicationDoseCount,
    };
  }

  private async gatherHistory(threadId: string, excludeMessageId: string): Promise<ChatTurn[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { threadId, id: { not: excludeMessageId } },
      orderBy: { createdAt: "desc" },
      take: CHAT_HISTORY_TURNS,
    });

    return rows.reverse().map((row) => ({
      role: row.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: row.content,
    }));
  }

  private async persistAssistantMessage(
    id: string,
    threadId: string,
    content: string,
    status: ChatMessageStatus,
    nudgeCategory: SymptomCategory | undefined,
    promptVersion: string,
  ): Promise<PrismaChatMessage> {
    return this.prisma.chatMessage.create({
      data: {
        id,
        threadId,
        role: "ASSISTANT",
        content,
        status,
        nudgeCategory: nudgeCategory ?? null,
        promptVersion,
        modelId: this.textModelId,
      },
    });
  }

  private async logCost(userId: string, status: ChatMessageStatus): Promise<void> {
    await this.costLog.record({
      costMicroUsd: 0,
      model: this.textModelId,
      status,
      userId,
    });
  }
}
