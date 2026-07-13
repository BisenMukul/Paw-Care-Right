import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { evaluateRedFlags } from "@pawcareright/ai";
import { parseIntake, parseTriage, type CheckStatus, type TriageResult } from "@pawcareright/types";
import { Prisma, type SymptomCheck, type TriageResult as PrismaTriageResult } from "@prisma/client";
import type { Queue } from "bullmq";

import { PetsService } from "../pets/pets.service";
import { PrismaService } from "../prisma/prisma.service";
import { ENTITLEMENT_RESOLVER, type EntitlementResolver } from "../quota/entitlement";
import { QuotaService } from "../quota/quota.service";
import { isTerminalCheckStatus } from "./check-status";
import { CHECKS_QUEUE, type ChecksJobData } from "./checks.contract";
import type { CreateCheckDto } from "./dto/create-check.dto";
import type { ListChecksQueryDto } from "./dto/list-checks-query.dto";
import { buildRedFlagIntake } from "./red-flag-intake.mapper";

export interface CheckRedFlag {
  ruleId: string;
  payloadKey: string;
}

/** Public resource shape (D4 — service-local, mirrors `pets.service.ts`' `PetResponse`). */
export interface CheckResponse {
  id: string;
  status: CheckStatus;
  category: string;
  createdAt: Date;
  redFlag?: CheckRedFlag;
  result?: TriageResult;
}

export interface CheckListResponse {
  items: CheckResponse[];
  nextCursor: string | null;
}

/** A `SymptomCheck` row, optionally joined to its `TriageResult` (present on `findOne`/`list`, absent right after `create`). */
type CheckRow = SymptomCheck & { result?: PrismaTriageResult | null };

const JOB_NAME = "triage";
const JOB_ATTEMPTS = 3;
const JOB_BACKOFF_DELAY_MS = 2000;
const COMPLETED_JOB_RETENTION_SECONDS = 3600;
const COMPLETED_JOB_RETENTION_COUNT = 1000;
const DEFAULT_LIST_LIMIT = 20;

/**
 * `POST /pets/:petId/checks` + `GET /checks/:id` + `GET /pets/:petId/checks`
 * business logic (T042). The `create` flow order is PRODUCT_SPEC §5-critical
 * (plan "Endpoint specs — ORDER IS §5-CRITICAL"): pet-404 -> idempotency
 * short-circuit -> parseIntake 400 -> deterministic red-flag rules -> EITHER
 * the red-flag path (no quota, D1) OR the quota path (402 on exceeded) ->
 * persist -> enqueue. Never logs `intakeJson`/`freeText`/`photoKeys`.
 */
@Injectable()
export class ChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly petsService: PetsService,
    private readonly quotaService: QuotaService,
    @Inject(ENTITLEMENT_RESOLVER) private readonly entitlementResolver: EntitlementResolver,
    @InjectQueue(CHECKS_QUEUE) private readonly queue: Queue<ChecksJobData>,
  ) {}

  async create(
    householdId: string,
    userId: string,
    petId: string,
    dto: CreateCheckDto,
    idempotencyKey: string | null,
  ): Promise<CheckResponse> {
    // 1. Pet must exist in the caller's household — 404, never a leak.
    const pet = await this.petsService.findOne(householdId, petId);

    // 2. Idempotency short-circuit (D5) — before parse, before quota.
    if (idempotencyKey !== null) {
      const existing = await this.prisma.symptomCheck.findUnique({
        where: { createdById_idempotencyKey: { createdById: userId, idempotencyKey } },
      });
      if (existing) {
        return this.toResponse(existing);
      }
    }

    // 3. Fail-closed intake validation.
    const parsed = parseIntake(dto.intake);
    if (!parsed.ok) {
      throw new BadRequestException(parsed.reason);
    }

    // 4. Deterministic red-flag rules run BEFORE any quota consideration.
    const redFlagIntake = buildRedFlagIntake(
      {
        species: pet.species,
        sex: pet.sex,
        ageEstimateMonths: pet.ageEstimateMonths,
        birthDate: pet.birthDate,
        weightGrams: pet.weightGrams,
      },
      parsed.value,
    );
    const evaluation = evaluateRedFlags(redFlagIntake);

    const basePersistData = {
      petId,
      createdById: userId,
      category: parsed.value.category,
      intakeJson: parsed.value as unknown as Prisma.InputJsonValue,
      photoKeys: dto.photoKeys ?? [],
      idempotencyKey,
    };

    let check: CheckRow;
    if (evaluation.highest !== null) {
      // 5. Red flag — persist immediately, NO quota consume (D1).
      check = await this.persistCheck({
        ...basePersistData,
        redFlagHit: true,
        redFlagRuleId: evaluation.highest.ruleId,
        redFlagPayloadKey: evaluation.highest.emergencyPayloadKey,
      });
    } else {
      // 6. No red flag — consume quota; 402 on exceeded, no persist/enqueue.
      const entitlement = await this.entitlementResolver.resolve(userId);
      const quotaResult = await this.quotaService.consume(userId, "checks", entitlement);
      if (!quotaResult.allowed) {
        throw new HttpException("Symptom-check quota exceeded.", HttpStatus.PAYMENT_REQUIRED);
      }

      check = await this.persistCheck({
        ...basePersistData,
        redFlagHit: false,
        redFlagRuleId: null,
        redFlagPayloadKey: null,
      });
    }

    // 8. Both paths enqueue (D2), jobId = checkId (idempotent re-enqueue).
    await this.enqueue(check.id);

    return this.toResponse(check);
  }

  async findOne(householdId: string, id: string): Promise<CheckResponse> {
    const check = await this.prisma.symptomCheck.findFirst({
      where: { id, pet: { householdId, deletedAt: null } },
      include: { result: true },
    });

    if (!check) {
      throw new NotFoundException();
    }

    return this.toResponse(check);
  }

  async list(householdId: string, petId: string, query: ListChecksQueryDto): Promise<CheckListResponse> {
    await this.petsService.findOne(householdId, petId);

    const limit = query.limit ?? DEFAULT_LIST_LIMIT;

    const rows = await this.prisma.symptomCheck.findMany({
      where: { petId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: { result: true },
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    // The cursor for the next page must be the LAST row actually returned
    // on this page (not the unreturned "extra" row) — pairing this with the
    // `cursor: { id }, skip: 1` query above means the next page resumes
    // exactly where this page ended, with no lost or duplicated rows.
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return { items: items.map((row) => this.toResponse(row)), nextCursor };
  }

  /** 7. P2002 race (D6): a concurrent replay with the same key wins the create — refetch and return it. */
  private async persistCheck(data: {
    petId: string;
    createdById: string;
    category: string;
    intakeJson: Prisma.InputJsonValue;
    photoKeys: string[];
    idempotencyKey: string | null;
    redFlagHit: boolean;
    redFlagRuleId: string | null;
    redFlagPayloadKey: string | null;
  }): Promise<SymptomCheck> {
    try {
      return await this.prisma.symptomCheck.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && data.idempotencyKey !== null) {
        const existing = await this.prisma.symptomCheck.findUnique({
          where: {
            createdById_idempotencyKey: { createdById: data.createdById, idempotencyKey: data.idempotencyKey },
          },
        });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  private async enqueue(checkId: string): Promise<void> {
    await this.queue.add(
      JOB_NAME,
      { checkId },
      {
        jobId: checkId,
        attempts: JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: JOB_BACKOFF_DELAY_MS },
        removeOnComplete: {
          age: COMPLETED_JOB_RETENTION_SECONDS,
          count: COMPLETED_JOB_RETENTION_COUNT,
        },
        removeOnFail: false,
      },
    );
  }

  private toResponse(check: CheckRow): CheckResponse {
    const response: CheckResponse = {
      id: check.id,
      status: check.status,
      category: check.category,
      createdAt: check.createdAt,
    };

    if (check.redFlagHit && check.redFlagRuleId !== null && check.redFlagPayloadKey !== null) {
      response.redFlag = { ruleId: check.redFlagRuleId, payloadKey: check.redFlagPayloadKey };
    }

    // `result` is included iff status is terminal AND a valid TriageResult
    // row exists — an invalid `resultJson` never surfaces (defensive fail-
    // closed read, ARCHITECTURE §3).
    if (isTerminalCheckStatus(check.status) && check.result) {
      const parsed = parseTriage(check.result.resultJson);
      if (parsed.ok) {
        response.result = parsed.result;
      }
    }

    return response;
  }
}
