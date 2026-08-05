import { HttpException, Logger, NotFoundException } from "@nestjs/common";
import { FakeTextProvider, SAFE_FALLBACK_CHAT_MESSAGE, scanUnsafeText } from "@bombaypetcompany/ai";
import type { TextGenerateOptions, TextStreamChunk } from "@bombaypetcompany/ai";
import type { Response } from "express";

import type { AiAuditService } from "../audit/ai-audit.service";
import type { PetResponse } from "../pets/pets.service";
import type { PetsService } from "../pets/pets.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { CostLogService } from "../quota/cost-log.service";
import type { EntitlementResolver } from "../quota/entitlement";
import type { QuotaService } from "../quota/quota.service";
import { ChatService } from "./chat.service";
import type { SendMessageDto } from "./dto/send-message.dto";
import { SseWriter } from "./sse-writer";

const HOUSEHOLD_ID = "household-1";
const USER_ID = "user-1";
const PET_ID = "pet-1";
const THREAD_ID = "thread-1";

function buildPet(overrides: Partial<PetResponse> = {}): PetResponse {
  return {
    id: PET_ID,
    householdId: HOUSEHOLD_ID,
    species: "DOG",
    sex: "UNKNOWN",
    name: "Fido",
    neutered: false,
    breedSlug: null,
    birthDate: null,
    ageEstimateMonths: null,
    weightGrams: null,
    photoKey: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildThreadRow() {
  return {
    id: THREAD_ID,
    petId: PET_ID,
    createdById: USER_ID,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    pet: {
      id: PET_ID,
      name: "Fido",
      species: "DOG",
      sex: "UNKNOWN",
      neutered: false,
      ageEstimateMonths: null,
      weightGrams: null,
    },
  };
}

interface Opts {
  petFindOne?: jest.Mock;
  entitlementResolve?: jest.Mock;
  quotaConsume?: jest.Mock;
  threadFindFirst?: jest.Mock;
  provider?: FakeTextProvider;
  aiAuditRecord?: jest.Mock;
}

function fakeResponse(): { res: Response; write: jest.Mock } {
  const write = jest.fn();
  const res = {
    writeHead: jest.fn(),
    write,
    end: jest.fn(),
    on: jest.fn(),
  } as unknown as Response;
  return { res, write };
}

function parseFrames(write: jest.Mock): Array<{ event: string; data: unknown }> {
  return write.mock.calls.map(([frame]: [string]) => {
    const match = /^event: (.+)\ndata: (.+)\n\n$/.exec(frame);
    if (!match) {
      throw new Error(`frame did not match the expected shape: ${frame}`);
    }
    return { event: match[1] as string, data: JSON.parse(match[2] as string) as unknown };
  });
}

function buildService(opts: Opts = {}): {
  service: ChatService;
  prisma: { chatThread: { findFirst: jest.Mock; create: jest.Mock }; chatMessage: { create: jest.Mock; findMany: jest.Mock }; healthLog: { findMany: jest.Mock }; symptomCheck: { findMany: jest.Mock }; reminderEvent: { count: jest.Mock } };
  provider: FakeTextProvider;
  generateSpy: jest.SpyInstance;
  aiAuditRecord: jest.Mock;
} {
  const prismaChatThread = {
    findFirst: opts.threadFindFirst ?? jest.fn().mockResolvedValue(buildThreadRow()),
    create: jest.fn().mockResolvedValue({ id: THREAD_ID, petId: PET_ID, createdAt: new Date("2026-07-01T00:00:00.000Z") }),
  };
  const prismaChatMessage = {
    create: jest.fn().mockImplementation((args: { data: { id?: string; role: string } }) =>
      Promise.resolve({ id: args.data.id ?? "user-msg-1", ...args.data }),
    ),
    findMany: jest.fn().mockResolvedValue([]),
  };
  const prismaHealthLog = { findMany: jest.fn().mockResolvedValue([]) };
  const prismaSymptomCheck = { findMany: jest.fn().mockResolvedValue([]) };
  const prismaReminderEvent = { count: jest.fn().mockResolvedValue(0) };

  const prisma = {
    chatThread: prismaChatThread,
    chatMessage: prismaChatMessage,
    healthLog: prismaHealthLog,
    symptomCheck: prismaSymptomCheck,
    reminderEvent: prismaReminderEvent,
  } as unknown as PrismaService;

  const petsService = { findOne: opts.petFindOne ?? jest.fn().mockResolvedValue(buildPet()) } as unknown as PetsService;

  const quotaService = {
    consume:
      opts.quotaConsume ??
      jest.fn().mockResolvedValue({ allowed: true, metric: "chatMessages", window: "month", limit: 200, used: 1, remaining: 199, unlimited: false }),
  } as unknown as QuotaService;

  const entitlementResolver = {
    resolve: opts.entitlementResolve ?? jest.fn().mockResolvedValue({ tier: "PREMIUM", bypassQuota: false }),
  } as unknown as EntitlementResolver;

  const costLog = { record: jest.fn().mockResolvedValue(undefined) } as unknown as CostLogService;

  const provider = opts.provider ?? new FakeTextProvider();
  const generateSpy = jest.spyOn(provider, "generate");

  const aiAuditRecord = opts.aiAuditRecord ?? jest.fn().mockResolvedValue(undefined);
  const aiAudit = { record: aiAuditRecord } as unknown as AiAuditService;

  const service = new ChatService(
    prisma,
    petsService,
    quotaService,
    costLog,
    entitlementResolver,
    provider,
    "test-model",
    aiAudit,
  );

  return {
    service,
    prisma: {
      chatThread: prismaChatThread,
      chatMessage: prismaChatMessage,
      healthLog: prismaHealthLog,
      symptomCheck: prismaSymptomCheck,
      reminderEvent: prismaReminderEvent,
    },
    provider,
    generateSpy,
    aiAuditRecord,
  };
}

function dto(content: string): SendMessageDto {
  return { content } as SendMessageDto;
}

describe("ChatService.createThread", () => {
  it("404s when the pet does not resolve in the caller's household", async () => {
    const petFindOne = jest.fn().mockRejectedValue(new NotFoundException());
    const { service } = buildService({ petFindOne });

    await expect(service.createThread(HOUSEHOLD_ID, USER_ID, { petId: PET_ID })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("402s FREE tier before creating a thread", async () => {
    const entitlementResolve = jest.fn().mockResolvedValue({ tier: "FREE", bypassQuota: false });
    const { service, prisma } = buildService({ entitlementResolve });

    await expect(service.createThread(HOUSEHOLD_ID, USER_ID, { petId: PET_ID })).rejects.toBeInstanceOf(HttpException);
    expect(prisma.chatThread.create).not.toHaveBeenCalled();
  });

  it("creates a thread for a PREMIUM caller", async () => {
    const { service, prisma } = buildService();

    const result = await service.createThread(HOUSEHOLD_ID, USER_ID, { petId: PET_ID });

    expect(result.id).toBe(THREAD_ID);
    expect(result.petId).toBe(PET_ID);
    expect(prisma.chatThread.create).toHaveBeenCalledTimes(1);
  });
});

describe("ChatService.streamMessage", () => {
  it("404s when the thread does not resolve in the caller's household", async () => {
    const threadFindFirst = jest.fn().mockResolvedValue(null);
    const { service } = buildService({ threadFindFirst });
    const { res } = fakeResponse();

    await expect(
      service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("402 is raised before any provider call or row write (FREE tier)", async () => {
    const entitlementResolve = jest.fn().mockResolvedValue({ tier: "FREE", bypassQuota: false });
    const { service, prisma, generateSpy } = buildService({ entitlementResolve });
    const { res } = fakeResponse();

    await expect(
      service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res)),
    ).rejects.toBeInstanceOf(HttpException);

    expect(generateSpy).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("402 is raised before any provider call or row write (quota exceeded)", async () => {
    const quotaConsume = jest.fn().mockResolvedValue({
      allowed: false,
      metric: "chatMessages",
      window: "month",
      limit: 200,
      used: 201,
      remaining: 0,
      unlimited: false,
    });
    const { service, prisma, generateSpy } = buildService({ quotaConsume });
    const { res } = fakeResponse();

    await expect(
      service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res)),
    ).rejects.toBeInstanceOf(HttpException);

    expect(generateSpy).not.toHaveBeenCalled();
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("falls back to a single chunk when the provider has no generateStream", async () => {
    const provider = new FakeTextProvider({
      canned: { text: "It's usually fine to keep an eye on it.", model: "fake-text-model", usage: { latencyMs: 1 } },
    });
    expect(typeof provider.generateStream).not.toBe("function");

    const { service } = buildService({ provider });
    const { res, write } = fakeResponse();

    await service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("Can dogs eat blueberries?"), new SseWriter(res));

    const frames = parseFrames(write);
    expect(frames.map((f) => f.event)).toEqual(["start", "chunk", "done"]);
    expect((frames[1]!.data as { text: string }).text).toBe("It's usually fine to keep an eye on it.");
    expect((frames[2]!.data as { status: string }).status).toBe("OK");
  });

  it("emits a nudge event immediately after start for a symptom-like message", async () => {
    const provider = new FakeTextProvider({ streamChunks: ["The Symptom Check is the best next step. "] });
    const { service } = buildService({ provider });
    const { res, write } = fakeResponse();

    await service.streamMessage(
      HOUSEHOLD_ID,
      USER_ID,
      THREAD_ID,
      dto("My dog has been vomiting since last night."),
      new SseWriter(res),
    );

    const frames = parseFrames(write);
    expect(frames[0]!.event).toBe("start");
    expect(frames[1]!.event).toBe("nudge");
    expect((frames[1]!.data as { category: string }).category).toBe("vomiting");
  });

  it("a flagged span aborts the stream and discards the buffer — later chunks are not consumed", async () => {
    const provider = new FakeTextProvider({
      streamChunks: ["Sure — give 5 mg/kg of ibuprofen every 8 hours. ", "This part should never be consumed."],
    });
    const { service } = buildService({ provider });
    const { res, write } = fakeResponse();

    await service.streamMessage(
      HOUSEHOLD_ID,
      USER_ID,
      THREAD_ID,
      dto("What should I give my dog for pain?"),
      new SseWriter(res),
    );

    const frames = parseFrames(write);
    const chunkTexts = frames.filter((f) => f.event === "chunk").map((f) => (f.data as { text: string }).text);
    const doneFrame = frames[frames.length - 1]!;

    expect(chunkTexts.join("")).not.toMatch(/mg\/kg|ibuprofen/i);
    expect((doneFrame.data as { status: string }).status).toBe("SAFE_FALLBACK");
    expect(chunkTexts.join("")).not.toContain("This part should never be consumed");
  });

  /** T082 F3 — the unsafe span straddles the forced 160-char release boundary. */
  function straddleChunks(): [string, string] {
    const filler = "x".repeat(150);
    return [`${filler} you could give 5 m`, "g/kg of ibuprofen every 8 hours. "];
  }

  it("F1: a post-header persistence failure still emits done and never rejects", async () => {
    const provider = new FakeTextProvider({ streamChunks: ["All good, keep an eye on him. "] });
    const { service, prisma } = buildService({ provider });
    const { res, write } = fakeResponse();
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    prisma.chatMessage.create.mockImplementation((args: { data: { id?: string; role: string } }) => {
      if (args.data.role === "ASSISTANT") {
        return Promise.reject(new Error("db connection lost"));
      }
      return Promise.resolve({ id: args.data.id ?? "user-msg-1", ...args.data });
    });

    await expect(
      service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res)),
    ).resolves.toBeUndefined();

    const frames = parseFrames(write);
    const lastFrame = frames[frames.length - 1]!;
    expect(lastFrame.event).toBe("done");
    expect((lastFrame.data as { status: string }).status).toBe("OK");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "chat_persist_failed",
        threadId: THREAD_ID,
        message: "db connection lost",
      }),
    );

    errorSpy.mockRestore();
  });

  it("F2: an empty completion converges on SAFE_FALLBACK", async () => {
    const provider = new FakeTextProvider({ streamChunks: [] });
    const { service, prisma } = buildService({ provider });
    const { res, write } = fakeResponse();

    await service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res));

    const frames = parseFrames(write);
    expect(frames.map((f) => f.event)).toEqual(["start", "chunk", "done"]);
    expect((frames[1]!.data as { text: string }).text).toBe(SAFE_FALLBACK_CHAT_MESSAGE);
    expect((frames[2]!.data as { status: string }).status).toBe("SAFE_FALLBACK");

    const assistantCall = prisma.chatMessage.create.mock.calls.find(
      ([args]: [{ data: { role: string } }]) => args.data.role === "ASSISTANT",
    ) as [{ data: { content: string } }] | undefined;
    expect(assistantCall?.[0].data.content).toBe(SAFE_FALLBACK_CHAT_MESSAGE);
  });

  it("F2: a client disconnect aborts the stream and persists what was delivered", async () => {
    let closeCallback: (() => void) | undefined;
    const write = jest.fn();
    const res = {
      writeHead: jest.fn(),
      write,
      end: jest.fn(),
      on: jest.fn((event: string, cb: () => void) => {
        if (event === "close") closeCallback = cb;
      }),
    } as unknown as Response;

    class DisconnectingProvider extends FakeTextProvider {
      constructor(onFirstDelta: () => void) {
        super({ streamChunks: ["Hello. ", "and more that must never be consumed."] });
        const original = this.generateStream!.bind(this);
        this.generateStream = async function* (options: TextGenerateOptions): AsyncGenerator<TextStreamChunk> {
          let first = true;
          for await (const chunk of original(options)) {
            yield chunk;
            if (first) {
              first = false;
              onFirstDelta();
            }
          }
        };
      }
    }

    const provider = new DisconnectingProvider(() => closeCallback?.());
    const { service, prisma } = buildService({ provider });

    await service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res));

    const frames = parseFrames(write);
    expect(frames.map((f) => f.event)).toEqual(["start", "chunk"]);
    expect((frames[1]!.data as { text: string }).text).toBe("Hello. ");
    expect(res.end).not.toHaveBeenCalled();

    const assistantCall = prisma.chatMessage.create.mock.calls.find(
      ([args]: [{ data: { role: string } }]) => args.data.role === "ASSISTANT",
    ) as [{ data: { content: string } }] | undefined;
    expect(assistantCall?.[0].data.content).toBe("Hello. ");
  });

  it("a straddling unsafe span aborts with SAFE_FALLBACK after partial release, logging one content-free chat_safety_incident", async () => {
    const [chunk1, chunk2] = straddleChunks();
    const provider = new FakeTextProvider({ streamChunks: [chunk1, chunk2] });
    const { service } = buildService({ provider });
    const { res, write } = fakeResponse();
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await service.streamMessage(
      HOUSEHOLD_ID,
      USER_ID,
      THREAD_ID,
      dto("What should I give my dog for pain?"),
      new SseWriter(res),
    );

    const frames = parseFrames(write);
    const chunkTexts = frames.filter((f) => f.event === "chunk").map((f) => (f.data as { text: string }).text);
    const doneFrame = frames[frames.length - 1]!;

    expect((doneFrame.data as { status: string }).status).toBe("SAFE_FALLBACK");
    expect(scanUnsafeText(chunkTexts.join(""))).toEqual([]);

    const incidentCall = warnSpy.mock.calls.find(
      ([payload]) => (payload as { event?: string }).event === "chat_safety_incident",
    );
    expect(incidentCall).toBeDefined();
    const payload = incidentCall?.[0] as {
      event: string;
      threadId: string;
      reason: string;
      codes: string[];
      releasedBeforeFlag: boolean;
    };
    expect(payload.threadId).toBe(THREAD_ID);
    expect(payload.reason).toBe("detector_finding");
    expect(payload.codes).toContain("DOSING");
    expect(payload.releasedBeforeFlag).toBe(true);

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("ibuprofen");
    expect(serialized).not.toContain("mg/kg");
    expect(serialized).not.toContain("What should I give my dog for pain?");

    warnSpy.mockRestore();
  });

  it("a provider error logs an incident with reason provider_error and no codes", async () => {
    const provider = new FakeTextProvider({
      streamChunks: ["Sure, "],
      streamError: new Error("connection reset"),
    });
    const { service } = buildService({ provider });
    const { res, write } = fakeResponse();
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("What's going on?"), new SseWriter(res));

    const frames = parseFrames(write);
    const doneFrame = frames[frames.length - 1]!;
    expect((doneFrame.data as { status: string }).status).toBe("SAFE_FALLBACK");

    const incidentCall = warnSpy.mock.calls.find(
      ([payload]) => (payload as { event?: string }).event === "chat_safety_incident",
    );
    expect(incidentCall).toBeDefined();
    const payload = incidentCall?.[0] as { reason: string; codes: string[]; error?: string };
    expect(payload.reason).toBe("provider_error");
    expect(payload.codes).toEqual([]);
    expect(payload.error).toBe("connection reset");

    warnSpy.mockRestore();
  });

  it("D4: a SAFE_FALLBACK answer persists only the fallback sentence, never the released prefix", async () => {
    const [chunk1, chunk2] = straddleChunks();
    const provider = new FakeTextProvider({ streamChunks: [chunk1, chunk2] });
    const { service, prisma } = buildService({ provider });
    const { res } = fakeResponse();

    await service.streamMessage(
      HOUSEHOLD_ID,
      USER_ID,
      THREAD_ID,
      dto("What should I give my dog for pain?"),
      new SseWriter(res),
    );

    const assistantCall = prisma.chatMessage.create.mock.calls.find(
      ([args]: [{ data: { role: string } }]) => args.data.role === "ASSISTANT",
    ) as [{ data: { content: string } }] | undefined;
    expect(assistantCall?.[0].data.content).toBe(SAFE_FALLBACK_CHAT_MESSAGE);
  });

  describe("AiAuditLog write (T090 plan step 17)", () => {
    it("writes an AiAuditLog row on the chat path", async () => {
      const provider = new FakeTextProvider({ streamChunks: ["All good, keep an eye on him. "] });
      const { service, aiAuditRecord } = buildService({ provider });
      const { res } = fakeResponse();

      await service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res));

      expect(aiAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          surface: "CHAT",
          threadId: THREAD_ID,
          promptVersion: expect.any(String) as string,
          modelId: "test-model",
          status: "OK",
        }),
      );
      const entry = aiAuditRecord.mock.calls[0]?.[0] as { checkId?: string; detectorFlags?: string[] };
      expect(entry.checkId).toBeUndefined();
      // T090 review F1 (probe P2): EXACT equality — a clean stream writes an
      // empty flag list, and nothing else (least of all message content) may
      // ride along at this call site. objectContaining alone cannot catch a
      // planted extra element.
      expect(entry.detectorFlags).toEqual([]);
    });

    it("carries gate finding codes in detectorFlags when the output gate fires", async () => {
      const [chunk1, chunk2] = straddleChunks();
      const provider = new FakeTextProvider({ streamChunks: [chunk1, chunk2] });
      const { service, aiAuditRecord } = buildService({ provider });
      const { res } = fakeResponse();

      await service.streamMessage(
        HOUSEHOLD_ID,
        USER_ID,
        THREAD_ID,
        dto("What should I give my dog for pain?"),
        new SseWriter(res),
      );

      expect(aiAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          surface: "CHAT",
          status: "SAFE_FALLBACK",
          detectorFlags: expect.arrayContaining(["DOSING"]) as string[],
        }),
      );
    });

    it("an audit write failure still emits done and ends the stream", async () => {
      const provider = new FakeTextProvider({ streamChunks: ["All good, keep an eye on him. "] });
      const aiAuditRecord = jest.fn().mockRejectedValue(new Error("audit db down"));
      const { service } = buildService({ provider, aiAuditRecord });
      const { res, write } = fakeResponse();

      await expect(
        service.streamMessage(HOUSEHOLD_ID, USER_ID, THREAD_ID, dto("hello"), new SseWriter(res)),
      ).resolves.toBeUndefined();

      const frames = parseFrames(write);
      const lastFrame = frames[frames.length - 1]!;
      expect(lastFrame.event).toBe("done");
      expect(res.end).toHaveBeenCalled();
    });
  });
});
