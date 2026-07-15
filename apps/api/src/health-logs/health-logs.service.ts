import { BadRequestException, Injectable } from "@nestjs/common";
import {
  healthLogPhotoKeysSchema,
  noteValueSchema,
  parseHealthLogValue,
  parseTriage,
  weightValueSchema,
  type HealthLogKind,
  type Urgency,
} from "@pawcareright/types";
import { Prisma, type HealthLog } from "@prisma/client";

import { PetsService } from "../pets/pets.service";
import { PrismaService } from "../prisma/prisma.service";
import { buildVetSummary, type VetSummaryInput } from "./build-vet-summary";
import { CREATABLE_HEALTH_LOG_KINDS, type CreateLogDto } from "./dto/create-log.dto";
import type { ListLogsQueryDto } from "./dto/list-logs-query.dto";
import type { WeightSeriesQueryDto } from "./dto/weight-series-query.dto";
import {
  downsampleWeightSeries,
  WEIGHT_SERIES_DOWNSAMPLE_MAX,
  type WeightSeriesPoint,
} from "./downsample-weight-series";
import { decodeCursor, encodeCursor, InvalidCursorError, type TimelineCursor } from "./timeline-cursor";

/** Public resource shape (D5 — service-local, mirrors `CheckResponse`/`ReminderResponse`). */
export interface HealthLogResponse {
  id: string;
  kind: HealthLogKind;
  occurredAt: string;
  value: Record<string, unknown>;
  photoKeys: string[];
}

export interface TimelineListResponse {
  items: HealthLogResponse[];
  nextCursor: string | null;
}

export interface WeightSeriesResponse {
  points: Array<{ t: string; grams: number }>;
  sampled: boolean;
}

/** `GET /pets/:petId/vet-summary` response (T068 plan decision 8). */
export interface VetSummaryResponse {
  summary: string;
}

const DEFAULT_LIST_LIMIT = 20;
const VET_SUMMARY_WINDOW_DAYS = 90;
const MS_PER_DAY = 86_400_000;

/** One row of either merge source, normalized to a common shape for the total-order merge (plan §6). */
interface MergedRow {
  id: string;
  kind: HealthLogKind;
  occurredAtDate: Date;
  sourceRank: 0 | 1;
  value: Record<string, unknown>;
  photoKeys: string[];
}

/**
 * `POST/GET /pets/:petId/logs` + `GET /pets/:petId/weight-series` business
 * logic (T064). `list`'s unfiltered path merges two sources -- persisted
 * `HealthLog` rows (sourceRank 0) and a read-time MED_GIVEN projection over
 * `ReminderEvent(status=DONE, completedAt not null)` (sourceRank 1, plan
 * decision D2) -- via the keyset cursor spec'd in plan §6. Every method
 * first resolves the pet in the caller's household (404, no leak).
 */
@Injectable()
export class HealthLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly petsService: PetsService,
  ) {}

  async create(householdId: string, petId: string, dto: CreateLogDto): Promise<HealthLogResponse> {
    await this.petsService.findOne(householdId, petId);

    // Defense-in-depth: the DTO's `@IsIn` already restricts `kind` to the
    // public-creatable set at the HTTP boundary, but the service rejects it
    // again so a direct caller (e.g. a unit test, or a future internal
    // caller) can never write a MED_GIVEN/CHECK_REF row through here.
    if (!(CREATABLE_HEALTH_LOG_KINDS as readonly string[]).includes(dto.kind)) {
      throw new BadRequestException(`kind must be one of ${CREATABLE_HEALTH_LOG_KINDS.join(", ")}`);
    }

    const parsedValue = parseHealthLogValue(dto.kind, dto.value);
    if (!parsedValue.ok) {
      throw new BadRequestException(parsedValue.reason);
    }

    const parsedPhotoKeys = healthLogPhotoKeysSchema.safeParse(dto.photoKeys ?? []);
    if (!parsedPhotoKeys.success) {
      throw new BadRequestException("photoKeys: too many keys or invalid entry");
    }

    const created = await this.prisma.healthLog.create({
      data: {
        petId,
        kind: dto.kind,
        valueJson: parsedValue.value as unknown as Prisma.InputJsonValue,
        photoKeys: parsedPhotoKeys.data,
        occurredAt: new Date(dto.occurredAt),
      },
    });

    return this.toResponse(created);
  }

  async list(householdId: string, petId: string, query: ListLogsQueryDto): Promise<TimelineListResponse> {
    await this.petsService.findOne(householdId, petId);

    const limit = query.limit ?? DEFAULT_LIST_LIMIT;

    let cursor: TimelineCursor | undefined;
    if (query.cursor !== undefined) {
      try {
        cursor = decodeCursor(query.cursor);
      } catch (err) {
        if (err instanceof InvalidCursorError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }

    let merged: MergedRow[];
    if (query.kind !== undefined && query.kind !== "MED_GIVEN") {
      merged = await this.fetchHealthLogRows(petId, limit, query.kind, cursor);
    } else if (query.kind === "MED_GIVEN") {
      merged = await this.fetchMedGivenRows(petId, limit, cursor);
    } else {
      const [healthLogRows, medGivenRows] = await Promise.all([
        this.fetchHealthLogRows(petId, limit, undefined, cursor),
        this.fetchMedGivenRows(petId, limit, cursor),
      ]);
      merged = this.mergeByTotalOrder(healthLogRows, medGivenRows);
    }

    const page = merged.slice(0, limit + 1);
    const hasMore = page.length > limit;
    const items = hasMore ? page.slice(0, limit) : page;

    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ o: last.occurredAtDate.toISOString(), s: last.sourceRank, i: last.id })
        : null;

    return { items: items.map((row) => this.mergedRowToResponse(row)), nextCursor };
  }

  async weightSeries(householdId: string, petId: string, query: WeightSeriesQueryDto): Promise<WeightSeriesResponse> {
    await this.petsService.findOne(householdId, petId);

    const occurredAtFilter: Prisma.DateTimeFilter = {};
    if (query.from !== undefined) {
      occurredAtFilter.gte = new Date(query.from);
    }
    if (query.to !== undefined) {
      occurredAtFilter.lte = new Date(query.to);
    }

    const rows = await this.prisma.healthLog.findMany({
      where: {
        petId,
        kind: "WEIGHT",
        ...(query.from !== undefined || query.to !== undefined ? { occurredAt: occurredAtFilter } : {}),
      },
      orderBy: { occurredAt: "asc" },
    });

    const points: WeightSeriesPoint[] = [];
    for (const row of rows) {
      const parsed = weightValueSchema.safeParse(row.valueJson);
      if (parsed.success) {
        points.push({ t: row.occurredAt.getTime(), grams: parsed.data.weightGrams });
      }
    }

    const sampled = points.length > WEIGHT_SERIES_DOWNSAMPLE_MAX;
    const downsampled = downsampleWeightSeries(points);

    return {
      points: downsampled.map((point) => ({ t: new Date(point.t).toISOString(), grams: point.grams })),
      sampled,
    };
  }

  /**
   * `GET /pets/:petId/vet-summary` (T068). Gathers the pet + the last
   * `VET_SUMMARY_WINDOW_DAYS` days of weight/note/symptom-check/completed-
   * medication rows, maps them to `VetSummaryInput`, and hands them to the
   * PURE `buildVetSummary` (plan decision 6) -- `Date.now()` is read exactly
   * once, here, to compute `windowStart`; the builder itself never touches
   * the clock (plan decision 4). Checks read `symptomCheck`/`reminderEvent`
   * directly (plan decision 7), the same posture as this service's existing
   * direct `reminderEvent` read for the MED_GIVEN projection above --
   * household scope is already enforced by the leading `petsService.findOne`
   * (404, no leak).
   */
  async vetSummary(householdId: string, petId: string): Promise<VetSummaryResponse> {
    const pet = await this.petsService.findOne(householdId, petId);

    const windowStart = new Date(Date.now() - VET_SUMMARY_WINDOW_DAYS * MS_PER_DAY);

    const [weightRows, noteRows, checkRows, medRows] = await Promise.all([
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
      this.prisma.reminderEvent.findMany({
        where: {
          status: "DONE",
          completedAt: { not: null, gte: windowStart },
          reminder: { petId, type: "MEDICATION" },
        },
        orderBy: { completedAt: "desc" },
        include: { reminder: true },
      }),
    ]);

    const input: VetSummaryInput = {
      pet: {
        name: pet.name,
        species: pet.species,
        ageEstimateMonths: pet.ageEstimateMonths,
        birthDate: pet.birthDate,
      },
      weights: weightRows.flatMap((row) => {
        const parsed = weightValueSchema.safeParse(row.valueJson);
        return parsed.success ? [{ occurredAt: row.occurredAt, grams: parsed.data.weightGrams }] : [];
      }),
      checks: checkRows.map((check) => {
        let tier: Urgency | null = null;
        if (check.result) {
          const parsed = parseTriage(check.result.resultJson);
          if (parsed.ok) {
            tier = parsed.result.urgency;
          }
        }
        return { createdAt: check.createdAt, tier };
      }),
      medsGiven: medRows.map((event) => ({
        // `completedAt` is guaranteed non-null by the `status: "DONE"` +
        // `completedAt: { not: null }` filter above.
        occurredAt: event.completedAt as Date,
        nameAsEntered: event.reminder.medNameAsEntered,
        doseAsEntered: event.reminder.medDoseAsEntered,
      })),
      notes: noteRows.flatMap((row) => {
        const parsed = noteValueSchema.safeParse(row.valueJson);
        return parsed.success ? [{ occurredAt: row.occurredAt, text: parsed.data.text }] : [];
      }),
    };

    return { summary: buildVetSummary(input) };
  }

  private async fetchHealthLogRows(
    petId: string,
    limit: number,
    kind: HealthLogKind | undefined,
    cursor: TimelineCursor | undefined,
  ): Promise<MergedRow[]> {
    const where: Prisma.HealthLogWhereInput = {
      petId,
      ...(kind !== undefined ? { kind } : {}),
      ...(cursor !== undefined ? this.healthLogAfterCursorWhere(cursor) : {}),
    };

    const rows = await this.prisma.healthLog.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      occurredAtDate: row.occurredAt,
      sourceRank: 0,
      value: row.valueJson as Record<string, unknown>,
      photoKeys: row.photoKeys,
    }));
  }

  private async fetchMedGivenRows(
    petId: string,
    limit: number,
    cursor: TimelineCursor | undefined,
  ): Promise<MergedRow[]> {
    const where: Prisma.ReminderEventWhereInput = {
      status: "DONE",
      completedAt: { not: null },
      reminder: { petId, type: "MEDICATION" },
      ...(cursor !== undefined ? this.medGivenAfterCursorWhere(cursor) : {}),
    };

    const rows = await this.prisma.reminderEvent.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { reminder: true },
    });

    return rows.map((event) => ({
      id: event.id,
      kind: "MED_GIVEN" as const,
      // `completedAt` is guaranteed non-null by the `status: "DONE"` + `completedAt: { not: null }` filter above.
      occurredAtDate: event.completedAt as Date,
      sourceRank: 1,
      value: {
        reminderEventId: event.id,
        ...(event.reminder.medNameAsEntered !== null ? { medNameAsEntered: event.reminder.medNameAsEntered } : {}),
        ...(event.reminder.medDoseAsEntered !== null ? { medDoseAsEntered: event.reminder.medDoseAsEntered } : {}),
      },
      photoKeys: [],
    }));
  }

  /** Plan §6: `occurredAt < o OR (occurredAt == o AND s == 0 AND id < i)`. */
  private healthLogAfterCursorWhere(cursor: TimelineCursor): Prisma.HealthLogWhereInput {
    const occurredAt = new Date(cursor.o);
    const or: Prisma.HealthLogWhereInput[] = [{ occurredAt: { lt: occurredAt } }];
    if (cursor.s === 0) {
      or.push({ occurredAt, id: { lt: cursor.i } });
    }
    return { OR: or };
  }

  /**
   * Plan §6: `completedAt < o OR (completedAt == o AND s == 0) OR
   * (completedAt == o AND s == 1 AND id < i)`.
   */
  private medGivenAfterCursorWhere(cursor: TimelineCursor): Prisma.ReminderEventWhereInput {
    const completedAt = new Date(cursor.o);
    const or: Prisma.ReminderEventWhereInput[] = [{ completedAt: { lt: completedAt } }];
    if (cursor.s === 0) {
      or.push({ completedAt });
    } else {
      or.push({ completedAt, id: { lt: cursor.i } });
    }
    return { OR: or };
  }

  /**
   * Merges two already-DB-sorted (occurredAt/completedAt DESC, id DESC)
   * lists into the single total order (occurredAt DESC, sourceRank ASC, id
   * DESC). Cross-source ties are broken purely by `sourceRank` (rank-0
   * before rank-1) -- `id` never needs to be compared in JS across sources,
   * since two rows from different sources always differ in `sourceRank`.
   * Within one source, relative order is simply preserved from the DB
   * fetch, which already applied the `id DESC` tiebreak natively.
   */
  private mergeByTotalOrder(healthLogRows: MergedRow[], medGivenRows: MergedRow[]): MergedRow[] {
    const merged: MergedRow[] = [];
    let i = 0;
    let j = 0;
    while (i < healthLogRows.length && j < medGivenRows.length) {
      const a = healthLogRows[i] as MergedRow;
      const b = medGivenRows[j] as MergedRow;
      if (a.occurredAtDate.getTime() >= b.occurredAtDate.getTime()) {
        merged.push(a);
        i += 1;
      } else {
        merged.push(b);
        j += 1;
      }
    }
    while (i < healthLogRows.length) {
      merged.push(healthLogRows[i] as MergedRow);
      i += 1;
    }
    while (j < medGivenRows.length) {
      merged.push(medGivenRows[j] as MergedRow);
      j += 1;
    }
    return merged;
  }

  private mergedRowToResponse(row: MergedRow): HealthLogResponse {
    return {
      id: row.id,
      kind: row.kind,
      occurredAt: row.occurredAtDate.toISOString(),
      value: row.value,
      photoKeys: row.photoKeys,
    };
  }

  private toResponse(row: HealthLog): HealthLogResponse {
    return {
      id: row.id,
      kind: row.kind,
      occurredAt: row.occurredAt.toISOString(),
      value: row.valueJson as Record<string, unknown>,
      photoKeys: row.photoKeys,
    };
  }
}
