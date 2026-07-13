import { Logger } from "@nestjs/common";
import { FakeTextProvider, ProviderError, TRIAGE_PROMPT_VERSION, type TextProvider, type TextResult } from "@pawcareright/ai";
import { parseIntake, type CompletedIntake, type Sex, type Species } from "@pawcareright/types";
import type { Job, Queue } from "bullmq";

import type { ChecksJobData } from "../checks/checks.contract";
import type { PrismaService } from "../prisma/prisma.service";
import type { CostLogService } from "../quota/cost-log.service";
import type { VisionPrepService } from "../vision/vision-prep.service";
import { CheckRunnerProcessor, isFinalAttempt } from "./check-runner.processor";
import type { FollowUpJobData } from "./followups.contract";

/**
 * Direct-invoke integration tests (T043 plan "Tests to write"): construct
 * `CheckRunnerProcessor` with mocked Prisma/VisionPrep/CostLog and a
 * scripted `FakeTextProvider`, and call `process()` on a hand-built
 * `Job`-shaped object -- same pattern as `images.processor.spec.ts` /
 * `vision-prep.service.spec.ts`. `parseIntake`, `buildRedFlagIntake`,
 * `evaluateRedFlags`, `runTriage`, `applyPostRules` all run for REAL; only
 * Prisma/VisionPrep/CostLog I/O is mocked.
 */
describe("CheckRunnerProcessor", () => {
  const CHECK_ID = "check-1";
  const USER_ID = "user-1";
  const MODEL_ID = "configured-text-model";

  function intake(raw: unknown): CompletedIntake {
    const parsed = parseIntake(raw);
    if (!parsed.ok) {
      throw new Error(`test fixture intake failed to parse: ${parsed.reason}`);
    }
    return parsed.value;
  }

  function benignIntake(freeText?: string): CompletedIntake {
    return intake({
      category: "not-eating",
      answers: [
        { questionId: "onset", type: "duration", value: 6, unit: "hours" },
        { questionId: "water", type: "single", value: "drinking-normally" },
        { questionId: "energy", type: "scale", value: 4 },
      ],
      ...(freeText !== undefined ? { freeText } : {}),
    });
  }

  function redFlagBreathingIntake(): CompletedIntake {
    return intake({
      category: "breathing",
      answers: [
        { questionId: "onset", type: "duration", value: 10, unit: "minutes" },
        { questionId: "character", type: "single", value: "normal" },
        { questionId: "gum-color", type: "single", value: "blue-purple" },
        { questionId: "energy", type: "scale", value: 2 },
      ],
    });
  }

  function buildPet(
    overrides: Partial<{
      species: Species;
      sex: Sex;
      name: string;
      neutered: boolean;
      birthDate: Date | null;
      ageEstimateMonths: number | null;
      weightGrams: number | null;
    }> = {},
  ) {
    return {
      species: overrides.species ?? "DOG",
      sex: overrides.sex ?? "UNKNOWN",
      name: overrides.name ?? "Fido",
      neutered: overrides.neutered ?? false,
      birthDate: overrides.birthDate ?? null,
      ageEstimateMonths: overrides.ageEstimateMonths ?? 24,
      weightGrams: overrides.weightGrams ?? 12000,
    };
  }

  function buildCheckRow(
    overrides: Partial<{
      status: string;
      intakeJson: CompletedIntake;
      photoKeys: string[];
      pet: ReturnType<typeof buildPet>;
    }> = {},
  ) {
    return {
      id: CHECK_ID,
      petId: "pet-1",
      createdById: USER_ID,
      status: overrides.status ?? "QUEUED",
      category: (overrides.intakeJson ?? benignIntake()).category,
      intakeJson: overrides.intakeJson ?? benignIntake(),
      photoKeys: overrides.photoKeys ?? [],
      redFlagHit: false,
      redFlagRuleId: null,
      redFlagPayloadKey: null,
      costMicroUsd: 0,
      failureReason: null,
      idempotencyKey: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      startedAt: null,
      completedAt: null,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      pet: overrides.pet ?? buildPet(),
    };
  }

  function buildJob(overrides: { attemptsMade?: number; attempts?: number } = {}): Job<ChecksJobData> {
    return {
      id: "job-1",
      data: { checkId: CHECK_ID },
      attemptsMade: overrides.attemptsMade ?? 0,
      opts: { attempts: overrides.attempts ?? 3 },
    } as unknown as Job<ChecksJobData>;
  }

  function triageResultText(overrides: { urgency?: string; confidence?: string; followUpHours?: number | null } = {}): string {
    return JSON.stringify({
      urgency: overrides.urgency ?? "MONITOR",
      confidence: overrides.confidence ?? "medium",
      summary: "Keep an eye on things and note any changes over the next day.",
      possibleCauses: [{ name: "Mild stomach upset", whyItFits: "Symptoms are mild and non-specific." }],
      redFlagsToWatch: ["Repeated vomiting", "Lethargy that worsens"],
      homeCare: ["Offer small amounts of water", "Monitor appetite"],
      doNot: ["Do not give human medications to your pet without a veterinarian's guidance."],
      vetQuestions: ["How long has this been going on?"],
      followUpHours: overrides.followUpHours === undefined ? 24 : overrides.followUpHours,
    });
  }

  function textResult(text: string): TextResult {
    return {
      text,
      model: "fake-text-model",
      usage: { latencyMs: 5, inputTokens: 10, outputTokens: 5, totalTokens: 15, costMicroUsd: 3 },
    };
  }

  function buildPrisma(
    opts: {
      check?: ReturnType<typeof buildCheckRow> | null;
      update?: jest.Mock;
    } = {},
  ) {
    const findUnique = jest.fn().mockResolvedValue("check" in opts ? opts.check : buildCheckRow());
    const update = opts.update ?? jest.fn().mockResolvedValue(undefined);
    const upsert = jest.fn().mockResolvedValue(undefined);
    const transaction = jest.fn((ops: unknown[]) => Promise.all(ops));

    const prisma = {
      symptomCheck: { findUnique, update },
      triageResult: { upsert },
      $transaction: transaction,
    } as unknown as PrismaService;

    return { prisma, findUnique, update, upsert, transaction };
  }

  function buildVisionPrep(overrides: { prepare?: jest.Mock } = {}) {
    const prepare =
      overrides.prepare ??
      jest.fn().mockResolvedValue({ images: [], requestedCount: 0, includedCount: 0, truncated: false, totalBase64Bytes: 0 });
    return { visionPrep: { prepare } as unknown as VisionPrepService, prepare };
  }

  function buildCostLog() {
    const record = jest.fn().mockResolvedValue(undefined);
    return { costLog: { record } as unknown as CostLogService, record };
  }

  function buildFollowUpQueue(overrides: { add?: jest.Mock } = {}) {
    const add = overrides.add ?? jest.fn().mockResolvedValue(undefined);
    return { followUpQueue: { add } as unknown as Queue<FollowUpJobData>, add };
  }

  it("happy path: QUEUED non-red-flag DOG check persists DONE + result + cost, no retry", async () => {
    const { prisma, update, upsert, transaction } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }) });
    const { visionPrep, prepare } = buildVisionPrep();
    const { costLog, record } = buildCostLog();
    const { followUpQueue, add } = buildFollowUpQueue();
    const provider = new FakeTextProvider({ script: [textResult(triageResultText({ urgency: "MONITOR" }))] });
    const generateSpy = jest.spyOn(provider, "generate");
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await processor.process(buildJob({ attemptsMade: 0, attempts: 3 }));

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(prepare).not.toHaveBeenCalled();

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: CHECK_ID },
      data: { status: "RUNNING", startedAt: expect.any(Date) as Date },
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { checkId: CHECK_ID },
        create: expect.objectContaining({
          checkId: CHECK_ID,
          urgency: "MONITOR",
          modelId: MODEL_ID,
          promptVersion: TRIAGE_PROMPT_VERSION,
        }) as unknown,
        update: expect.objectContaining({ urgency: "MONITOR", modelId: MODEL_ID }) as unknown,
      }),
    );

    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: CHECK_ID },
      data: { status: "DONE", completedAt: expect.any(Date) as Date, costMicroUsd: 3, failureReason: null },
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ checkId: CHECK_ID, userId: USER_ID, status: "OK", costMicroUsd: 3 }),
    );

    // followUpHours: 24 -> a delayed follow-up job is enqueued (T051 plan
    // "Scheduling spec"), jobId-keyed for idempotent re-enqueue.
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      "followup-prompt",
      { checkId: CHECK_ID },
      expect.objectContaining({ jobId: CHECK_ID, delay: 86_400_000 }),
    );
  });

  it("malformed provider output (both attempts) -> persists FALLBACK, no BullMQ retry", async () => {
    const { prisma, update, upsert } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }) });
    const { visionPrep } = buildVisionPrep();
    const { costLog } = buildCostLog();
    const { followUpQueue } = buildFollowUpQueue();
    const provider = new FakeTextProvider({
      script: [textResult("not json at all"), textResult("still not json")],
    });
    const generateSpy = jest.spyOn(provider, "generate");
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await expect(processor.process(buildJob({ attemptsMade: 0, attempts: 3 }))).resolves.toBeUndefined();

    expect(generateSpy).toHaveBeenCalledTimes(2);
    // `runTriage`'s exhausted-repair branch carries no provider `usage` --
    // costMicroUsd defaults to 0 (Math.max(0, Math.round(undefined ?? 0))).
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: CHECK_ID },
      data: {
        status: "FALLBACK",
        completedAt: expect.any(Date) as Date,
        costMicroUsd: 0,
        failureReason: expect.any(String) as string,
      },
    });

    const upsertCall = upsert.mock.calls[0]?.[0] as { create: { urgency: string; confidence: string } };
    expect(upsertCall.create.urgency).toBe("VET_SOON");
    expect(upsertCall.create.confidence).toBe("low");
  });

  it("provider timeout is absorbed to FALLBACK on the first attempt (no BullMQ retry)", async () => {
    const { prisma, update } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }) });
    const { visionPrep } = buildVisionPrep();
    const { costLog } = buildCostLog();
    const { followUpQueue } = buildFollowUpQueue();
    const generate = jest.fn().mockRejectedValue(new ProviderError("ollama", "timeout", "request timed out"));
    const provider: TextProvider = { generate };
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await expect(processor.process(buildJob({ attemptsMade: 0, attempts: 3 }))).resolves.toBeUndefined();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: CHECK_ID },
      data: {
        status: "FALLBACK",
        completedAt: expect.any(Date) as Date,
        costMicroUsd: expect.any(Number) as number,
        failureReason: expect.any(String) as string,
      },
    });
  });

  it("infra failure: non-final attempt rethrows (BullMQ retries)", async () => {
    const update = jest.fn().mockRejectedValueOnce(new Error("db down"));
    const { prisma } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }), update });
    const { visionPrep } = buildVisionPrep();
    const { costLog, record } = buildCostLog();
    const { followUpQueue, add } = buildFollowUpQueue();
    const provider = new FakeTextProvider({ script: [textResult(triageResultText())] });
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await expect(processor.process(buildJob({ attemptsMade: 0, attempts: 3 }))).rejects.toThrow("db down");

    expect(update).toHaveBeenCalledTimes(1);
    expect(prisma.triageResult.upsert).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("infra failure: final attempt writes floored FALLBACK and resolves (no rethrow)", async () => {
    const update = jest.fn().mockRejectedValueOnce(new Error("db down"));
    const { prisma } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }), update });
    const { visionPrep } = buildVisionPrep();
    const { costLog, record } = buildCostLog();
    const { followUpQueue, add } = buildFollowUpQueue();
    const provider = new FakeTextProvider({ script: [textResult(triageResultText())] });
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await expect(processor.process(buildJob({ attemptsMade: 2, attempts: 3 }))).resolves.toBeUndefined();

    // 1: the failed QUEUED->RUNNING transition, 2: the catch's recovery
    // transition, 3: the final FALLBACK status write (inside $transaction).
    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenNthCalledWith(3, {
      where: { id: CHECK_ID },
      data: { status: "FALLBACK", completedAt: expect.any(Date) as Date, costMicroUsd: 0, failureReason: "db down" },
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ checkId: CHECK_ID, userId: USER_ID, status: "SAFE_FALLBACK", costMicroUsd: 0 }),
    );
    // The catch-path fallback also schedules a follow-up (SAFE_FALLBACK's
    // `followUpHours` is 24).
    expect(add).toHaveBeenCalledWith(
      "followup-prompt",
      { checkId: CHECK_ID },
      expect.objectContaining({ jobId: CHECK_ID, delay: 86_400_000 }),
    );
  });

  it("rules floor is preserved even when the AI says REASSURE (red-flag DOG check)", async () => {
    const { prisma, update, upsert } = buildPrisma({
      check: buildCheckRow({ status: "QUEUED", intakeJson: redFlagBreathingIntake() }),
    });
    const { visionPrep } = buildVisionPrep();
    const { costLog } = buildCostLog();
    const { followUpQueue } = buildFollowUpQueue();
    const provider = new FakeTextProvider({
      script: [textResult(triageResultText({ urgency: "REASSURE", confidence: "high" }))],
    });
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await processor.process(buildJob({ attemptsMade: 0, attempts: 3 }));

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ urgency: "EMERGENCY_NOW" }) as unknown,
        update: expect.objectContaining({ urgency: "EMERGENCY_NOW" }) as unknown,
      }),
    );
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: CHECK_ID },
      data: { status: "DONE", completedAt: expect.any(Date) as Date, costMicroUsd: 3, failureReason: null },
    });
  });

  it("terminal check (DONE) is a no-op: no writes, no provider call", async () => {
    const { prisma, findUnique, update, upsert, transaction } = buildPrisma({
      check: buildCheckRow({ status: "DONE" }),
    });
    const { visionPrep, prepare } = buildVisionPrep();
    const { costLog, record } = buildCostLog();
    const { followUpQueue, add } = buildFollowUpQueue();
    const generate = jest.fn();
    const provider: TextProvider = { generate };
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await processor.process(buildJob());

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("missing check row is a no-op ack (row deleted / redelivered)", async () => {
    const { prisma, update, upsert } = buildPrisma({ check: null });
    const { visionPrep } = buildVisionPrep();
    const { costLog } = buildCostLog();
    const { followUpQueue, add } = buildFollowUpQueue();
    const provider = new FakeTextProvider();
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    await expect(processor.process(buildJob())).resolves.toBeUndefined();

    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });

  it("logs are checkId-keyed and never carry intakeJson/freeText/photoKeys", async () => {
    const SECRET_FREE_TEXT = "OWNER_SECRET_FREE_TEXT_MARKER";
    const { prisma } = buildPrisma({
      check: buildCheckRow({ status: "QUEUED", intakeJson: benignIntake(SECRET_FREE_TEXT), photoKeys: ["photo-key-1"] }),
    });
    const { visionPrep } = buildVisionPrep({
      prepare: jest
        .fn()
        .mockResolvedValue({ images: [], requestedCount: 1, includedCount: 1, truncated: false, totalBase64Bytes: 10 }),
    });
    const { costLog } = buildCostLog();
    const { followUpQueue } = buildFollowUpQueue();
    const provider = new FakeTextProvider({ script: [textResult(triageResultText())] });
    const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    try {
      await processor.process(buildJob());

      const allCalls = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls];
      expect(allCalls.length).toBeGreaterThan(0);
      for (const [entry] of allCalls) {
        expect(entry).toEqual(expect.objectContaining({ checkId: CHECK_ID }));
        if (typeof entry === "object" && entry !== null) {
          expect(entry).not.toHaveProperty("intakeJson");
          expect(entry).not.toHaveProperty("freeText");
          expect(entry).not.toHaveProperty("photoKeys");
        }
        expect(JSON.stringify(entry)).not.toContain(SECRET_FREE_TEXT);
      }
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("vision prep is invoked iff the check has photos", async () => {
    const { prisma: prismaWithPhotos } = buildPrisma({
      check: buildCheckRow({ status: "QUEUED", photoKeys: ["k1"] }),
    });
    const { visionPrep: visionWithPhotos, prepare: prepareWithPhotos } = buildVisionPrep({
      prepare: jest
        .fn()
        .mockResolvedValue({ images: [], requestedCount: 1, includedCount: 1, truncated: false, totalBase64Bytes: 5 }),
    });
    const { costLog: costLog1 } = buildCostLog();
    const { followUpQueue: followUpQueue1 } = buildFollowUpQueue();
    const provider1 = new FakeTextProvider({ script: [textResult(triageResultText())] });
    const processorWithPhotos = new CheckRunnerProcessor(
      prismaWithPhotos,
      visionWithPhotos,
      costLog1,
      provider1,
      MODEL_ID,
      followUpQueue1,
    );

    await processorWithPhotos.process(buildJob());

    expect(prepareWithPhotos).toHaveBeenCalledWith({ intake: benignIntake(), checkId: CHECK_ID });

    const { prisma: prismaNoPhotos } = buildPrisma({ check: buildCheckRow({ status: "QUEUED", photoKeys: [] }) });
    const { visionPrep: visionNoPhotos, prepare: prepareNoPhotos } = buildVisionPrep();
    const { costLog: costLog2 } = buildCostLog();
    const { followUpQueue: followUpQueue2 } = buildFollowUpQueue();
    const provider2 = new FakeTextProvider({ script: [textResult(triageResultText())] });
    const processorNoPhotos = new CheckRunnerProcessor(
      prismaNoPhotos,
      visionNoPhotos,
      costLog2,
      provider2,
      MODEL_ID,
      followUpQueue2,
    );

    await processorNoPhotos.process(buildJob());

    expect(prepareNoPhotos).not.toHaveBeenCalled();
  });

  describe("follow-up scheduling (T051 plan 'Scheduling spec')", () => {
    it("followUpHours: null -> no follow-up job is enqueued", async () => {
      const { prisma } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }) });
      const { visionPrep } = buildVisionPrep();
      const { costLog } = buildCostLog();
      const { followUpQueue, add } = buildFollowUpQueue();
      const provider = new FakeTextProvider({ script: [textResult(triageResultText({ followUpHours: null }))] });
      const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

      await processor.process(buildJob({ attemptsMade: 0, attempts: 3 }));

      expect(add).not.toHaveBeenCalled();
    });

    it("scheduling failure (queue.add rejects) never fails the job -- the DONE $transaction already ran", async () => {
      const { prisma, update, transaction } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }) });
      const { visionPrep } = buildVisionPrep();
      const { costLog, record } = buildCostLog();
      const { followUpQueue, add } = buildFollowUpQueue({ add: jest.fn().mockRejectedValue(new Error("redis down")) });
      const provider = new FakeTextProvider({ script: [textResult(triageResultText({ urgency: "MONITOR" }))] });
      const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

      await expect(processor.process(buildJob({ attemptsMade: 0, attempts: 3 }))).resolves.toBeUndefined();

      expect(add).toHaveBeenCalledTimes(1);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenNthCalledWith(2, {
        where: { id: CHECK_ID },
        data: { status: "DONE", completedAt: expect.any(Date) as Date, costMicroUsd: 3, failureReason: null },
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ checkId: CHECK_ID, userId: USER_ID, status: "OK", costMicroUsd: 3 }),
      );
    });

    it("scheduling failure on the catch-path FALLBACK never fails the job -- the FALLBACK $transaction already ran", async () => {
      const update = jest.fn().mockRejectedValueOnce(new Error("db down"));
      const { prisma } = buildPrisma({ check: buildCheckRow({ status: "QUEUED" }), update });
      const { visionPrep } = buildVisionPrep();
      const { costLog, record } = buildCostLog();
      const { followUpQueue, add } = buildFollowUpQueue({ add: jest.fn().mockRejectedValue(new Error("redis down")) });
      const provider = new FakeTextProvider({ script: [textResult(triageResultText())] });
      const processor = new CheckRunnerProcessor(prisma, visionPrep, costLog, provider, MODEL_ID, followUpQueue);

      await expect(processor.process(buildJob({ attemptsMade: 2, attempts: 3 }))).resolves.toBeUndefined();

      expect(add).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenNthCalledWith(3, {
        where: { id: CHECK_ID },
        data: { status: "FALLBACK", completedAt: expect.any(Date) as Date, costMicroUsd: 0, failureReason: "db down" },
      });
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ checkId: CHECK_ID, userId: USER_ID, status: "SAFE_FALLBACK", costMicroUsd: 0 }),
      );
    });
  });

  describe("isFinalAttempt", () => {
    it.each([
      [0, 3, false],
      [1, 3, false],
      [2, 3, true],
      [0, 1, true],
      [0, undefined, true],
    ])("attemptsMade=%p, opts.attempts=%p -> %p", (attemptsMade, attempts, expected) => {
      expect(isFinalAttempt({ attemptsMade, opts: { attempts } })).toBe(expected);
    });
  });
});
