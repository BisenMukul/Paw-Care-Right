import { HttpException, NotFoundException } from "@nestjs/common";
import { FakeTextProvider } from "@pawcareright/ai";
import type { Response } from "express";

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

  const service = new ChatService(prisma, petsService, quotaService, costLog, entitlementResolver, provider, "test-model");

  return { service, prisma: { chatThread: prismaChatThread, chatMessage: prismaChatMessage, healthLog: prismaHealthLog, symptomCheck: prismaSymptomCheck, reminderEvent: prismaReminderEvent }, provider, generateSpy };
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
});
