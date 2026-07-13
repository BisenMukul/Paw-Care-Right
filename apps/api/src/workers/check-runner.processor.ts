import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  applyPostRules,
  evaluateRedFlags,
  runTriage,
  TRIAGE_PROMPT_VERSION,
  type TextProvider,
  type TriagePetContext,
} from "@pawcareright/ai";
import { SAFE_FALLBACK, parseIntake, type CheckStatus, type Urgency } from "@pawcareright/types";
import type { Job } from "bullmq";

import { assertTransition, isTerminalCheckStatus } from "../checks/check-status";
import { CHECKS_QUEUE, type ChecksJobData } from "../checks/checks.contract";
import { buildRedFlagIntake, type PetProfileInput } from "../checks/red-flag-intake.mapper";
import { PrismaService } from "../prisma/prisma.service";
import { CostLogService } from "../quota/cost-log.service";
import { VisionPrepService } from "../vision/vision-prep.service";
import { TRIAGE_TEXT_MODEL_ID, TRIAGE_TEXT_PROVIDER } from "./check-runner.tokens";

/**
 * Pure helper (T043 plan "Error/retry semantics" #1): a job is on its final
 * attempt when the attempt about to run (`attemptsMade + 1`, 1-indexed) is
 * the last one the committed enqueue opts allow. Verified against the
 * installed `bullmq@5.80.1`: `Worker.processJob` calls the processor BEFORE
 * `job.moveToCompleted`/`job.moveToFailed` increment `attemptsMade` (see
 * `dist/esm/classes/worker.js` `processJob` -> `callProcessJob` then
 * `handleCompleted`/`handleFailed`), so during `process()` execution
 * `attemptsMade` holds the count of PRIOR attempts only (0 on the very
 * first call) -- exactly the semantics this predicate assumes. Exported for
 * direct unit testing (plan "Files to create/modify").
 */
export function isFinalAttempt(job: Pick<Job<ChecksJobData>, "attemptsMade" | "opts">): boolean {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}

/**
 * Consumes `pawcareright-checks` "triage" jobs (T043): load the check + pet,
 * recompute the deterministic red-flag rules floor, prep photos (T034,
 * text-only `runTriage` does not consume them -- plan R7), run the
 * provider-injected triage pipeline (T033), apply the post-rules safety
 * composition (T036), and persist atomically. Provider errors are absorbed
 * by `runTriage` into `SAFE_FALLBACK` on the first attempt (plan R4) -- only
 * infra throws (Prisma/VisionPrep/storage) drive BullMQ retries, with the
 * final attempt failing upward to a floored `FALLBACK` instead of a silent
 * guess (CLAUDE §7 rule 5 / PRODUCT_SPEC §5). Never logs
 * `intakeJson`/`freeText`/`photoKeys`/raw provider text -- every log object
 * is checkId-keyed with safe scalars only.
 */
@Injectable()
@Processor(CHECKS_QUEUE)
export class CheckRunnerProcessor extends WorkerHost {
  private readonly logger = new Logger(CheckRunnerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visionPrep: VisionPrepService,
    private readonly costLog: CostLogService,
    @Inject(TRIAGE_TEXT_PROVIDER) private readonly textProvider: TextProvider,
    @Inject(TRIAGE_TEXT_MODEL_ID) private readonly textModelId: string,
  ) {
    super();
  }

  async process(job: Job<ChecksJobData>): Promise<void> {
    const { checkId } = job.data;
    this.logger.log({ event: "triage_start", checkId, attempt: job.attemptsMade });

    const check = await this.prisma.symptomCheck.findUnique({
      where: { id: checkId },
      include: { pet: true },
    });

    if (check === null) {
      // Redelivered/duplicate job for a row that no longer exists -- ack,
      // nothing to do.
      this.logger.warn({ event: "triage_missing", checkId });
      return;
    }

    if (isTerminalCheckStatus(check.status)) {
      // Redelivered/duplicate job for an already-finished check -- no
      // writes, no provider call.
      this.logger.log({ event: "triage_noop_terminal", checkId, status: check.status });
      return;
    }

    // Tracks whether the QUEUED->RUNNING transition has already landed, so
    // the catch below knows whether it still needs to perform it (only true
    // when the check was already RUNNING at load time -- a crash-retry of a
    // prior attempt that must NOT reset `startedAt`).
    let startedRunning = check.status === "RUNNING";
    let rulesFloor: Urgency | null = null;

    try {
      if (!startedRunning) {
        assertTransition("QUEUED", "RUNNING");
        await this.prisma.symptomCheck.update({
          where: { id: checkId },
          data: { status: "RUNNING", startedAt: new Date() },
        });
        startedRunning = true;
      }

      // Defensive re-parse: the intake was validated at create time, but
      // re-validate fail-closed here too. The reason string is a schema
      // message (safe), but it is deliberately not folded into any
      // intake-shaped log object.
      const parsedIntake = parseIntake(check.intakeJson);
      if (!parsedIntake.ok) {
        throw new Error(`intake failed revalidation: ${parsedIntake.reason}`);
      }
      const intake = parsedIntake.value;

      const petProfile: PetProfileInput = {
        species: check.pet.species,
        sex: check.pet.sex,
        ageEstimateMonths: check.pet.ageEstimateMonths,
        birthDate: check.pet.birthDate,
        weightGrams: check.pet.weightGrams,
      };
      // rulesFloor is RECOMPUTED (not read from the stored `redFlagRuleId`,
      // which is a rule id and not a tier) via the same mapper+engine used
      // at create time -- deterministic given the same immutable
      // `intakeJson` (plan R1). `redFlagIntake`'s derived `ageMonths`/
      // `weightKg` are reused below for `TriagePetContext` rather than
      // re-deriving the same date/unit math a second time.
      const redFlagIntake = buildRedFlagIntake(petProfile, intake);
      const evaluation = evaluateRedFlags(redFlagIntake);
      rulesFloor = evaluation.highest?.tierFloor ?? null;

      // Vision prep only when the check has photos -- exercises T034's
      // fetch/downscale/safety/log pipeline. Its output is NOT fed to
      // `runTriage` (text-only, T033) -- vision-provider triage is deferred
      // (plan R7).
      if (check.photoKeys.length > 0) {
        const prepared = await this.visionPrep.prepare({ intake, checkId });
        this.logger.log({
          event: "vision_prepared",
          checkId,
          includedCount: prepared.includedCount,
          requestedCount: prepared.requestedCount,
          truncated: prepared.truncated,
        });
      }

      // Whitelisted fields ONLY -- no email/householdId/userId/ownerName
      // ever reaches the prompt layer. `breedLabel` is omitted (needs a
      // breed lookup, out of scope -- mirrors the mapper omitting
      // `sizeClass`).
      const petContext: TriagePetContext = {
        name: check.pet.name,
        species: check.pet.species,
        sex: check.pet.sex,
        neutered: check.pet.neutered,
        ...(redFlagIntake.ageMonths !== undefined ? { ageMonths: redFlagIntake.ageMonths } : {}),
        ...(redFlagIntake.weightKg !== undefined ? { weightKg: redFlagIntake.weightKg } : {}),
      };

      // `runTriage` never throws -- provider timeouts/HTTP/parse failures
      // are absorbed into `SAFE_FALLBACK` on this same, first attempt (plan
      // R4); BullMQ retries are reserved for infra throws below.
      const run = await runTriage({ pet: petContext, intake }, { provider: this.textProvider });

      // Post-rules composition -- the rules tier floor can only ever RAISE
      // urgency, never lower it, even when the AI result is REASSURE
      // (PRODUCT_SPEC §5 rule 3).
      const outcome = applyPostRules(run.result, { species: check.pet.species, rulesFloor });

      const target: CheckStatus = run.status === "SAFE_FALLBACK" ? "FALLBACK" : "DONE";
      assertTransition("RUNNING", target);

      const costMicroUsd = Math.max(0, Math.round(run.usage?.costMicroUsd ?? 0));
      const failureReason = run.status === "SAFE_FALLBACK" ? (run.failureReason ?? "safe_fallback") : null;

      await this.prisma.$transaction([
        this.prisma.triageResult.upsert({
          where: { checkId },
          create: {
            checkId,
            urgency: outcome.result.urgency,
            confidence: outcome.result.confidence,
            resultJson: outcome.result,
            modelId: this.textModelId,
            promptVersion: run.version,
          },
          update: {
            urgency: outcome.result.urgency,
            confidence: outcome.result.confidence,
            resultJson: outcome.result,
            modelId: this.textModelId,
            promptVersion: run.version,
          },
        }),
        this.prisma.symptomCheck.update({
          where: { id: checkId },
          data: { status: target, completedAt: new Date(), costMicroUsd, failureReason },
        }),
      ]);

      await this.costLog.record({
        costMicroUsd,
        ...(run.usage?.latencyMs !== undefined ? { latencyMs: run.usage.latencyMs } : {}),
        model: this.textModelId,
        status: run.status,
        userId: check.createdById,
        checkId,
      });

      this.logger.log({
        event: "triage_done",
        checkId,
        status: target,
        finalTier: outcome.finalTier,
        source: outcome.source,
        appliedRulesFloor: outcome.appliedRulesFloor,
        attempts: run.attempts,
        costMicroUsd,
      });
    } catch (err) {
      // Infra errors ARE retried. A provider timeout never reaches here
      // (absorbed inside `runTriage` above) -- only throws from
      // `prisma.*`/`visionPrep.prepare`/`$transaction` land in this catch.
      if (!isFinalAttempt(job)) {
        this.logger.warn({ event: "triage_infra_retry", checkId, attempt: job.attemptsMade });
        throw err;
      }

      // Final attempt: fail upward to a floored FALLBACK instead of a
      // silent retry-and-guess. If the throw happened before `rulesFloor`
      // was computed, `rulesFloor` is still `null` here, which is the
      // correct "no rules signal available" input to `applyPostRules`.
      const message = err instanceof Error ? err.message : String(err);
      const outcome = applyPostRules(SAFE_FALLBACK, { species: check.pet.species, rulesFloor });

      if (!startedRunning) {
        assertTransition("QUEUED", "RUNNING");
        await this.prisma.symptomCheck.update({
          where: { id: checkId },
          data: { status: "RUNNING", startedAt: new Date() },
        });
        startedRunning = true;
      }
      assertTransition("RUNNING", "FALLBACK");

      // If this persist itself throws (DB fully down), it propagates
      // uncaught -- the job lands in BullMQ's failed set
      // (`removeOnFail:false` retains it as a dead-letter for inspection).
      await this.prisma.$transaction([
        this.prisma.triageResult.upsert({
          where: { checkId },
          create: {
            checkId,
            urgency: outcome.result.urgency,
            confidence: outcome.result.confidence,
            resultJson: outcome.result,
            modelId: this.textModelId,
            promptVersion: TRIAGE_PROMPT_VERSION,
          },
          update: {
            urgency: outcome.result.urgency,
            confidence: outcome.result.confidence,
            resultJson: outcome.result,
            modelId: this.textModelId,
            promptVersion: TRIAGE_PROMPT_VERSION,
          },
        }),
        this.prisma.symptomCheck.update({
          where: { id: checkId },
          data: { status: "FALLBACK", completedAt: new Date(), costMicroUsd: 0, failureReason: message },
        }),
      ]);

      await this.costLog.record({
        costMicroUsd: 0,
        model: this.textModelId,
        status: "SAFE_FALLBACK",
        userId: check.createdById,
        checkId,
      });

      this.logger.error({ event: "triage_infra_fallback", checkId, message });
      return;
    }
  }
}
