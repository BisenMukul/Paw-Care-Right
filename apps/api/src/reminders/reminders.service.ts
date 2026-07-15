import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { resolveCareTemplate, resolveCareTemplateForPet, resolveLifeStage } from "@pawcareright/data";
import { parseRRule, type CareTemplateSuggestions, type ReminderEventStatus, type Species } from "@pawcareright/types";
import type { Reminder, ReminderEvent } from "@prisma/client";

import { PetsService } from "../pets/pets.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AgendaQueryDto } from "./dto/agenda-query.dto";
import type { CompleteOccurrenceDto } from "./dto/complete-occurrence.dto";
import type { CreateReminderDto } from "./dto/create-reminder.dto";
import type { InstantiateTemplateDto } from "./dto/instantiate-template.dto";
import type { ListRemindersQueryDto } from "./dto/list-reminders-query.dto";
import type { SnoozeOccurrenceDto } from "./dto/snooze-occurrence.dto";
import type { TemplateSuggestionsQueryDto } from "./dto/template-suggestions-query.dto";
import type { UpdateReminderDto } from "./dto/update-reminder.dto";
import { computeNextFireAt } from "./next-fire-at";
import { occurrencesBetween } from "./occurrences-between";
import { deriveTemplateStartAt, petAgeMonths } from "./template-anchors";

/** Public resource shape (service-local, mirrors `pets.service.ts`'s `PetResponse` / `checks.service.ts`'s `CheckResponse`). */
export interface ReminderResponse {
  id: string;
  petId: string;
  type: string;
  title: string;
  rrule: string;
  timezone: string;
  startAt: Date;
  nextFireAt: Date;
  medNameAsEntered?: string;
  active: boolean;
  templateKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderListResponse {
  items: ReminderResponse[];
  nextCursor: string | null;
}

export interface AgendaEntry {
  reminderId: string;
  petId: string;
  type: string;
  title: string;
  dueAt: Date;
  status: ReminderEventStatus | "SCHEDULED";
  virtual: boolean;
  eventId?: string;
}

export interface AgendaResponse {
  from: Date;
  to: Date;
  entries: AgendaEntry[];
}

export interface InstantiateTemplateResponse {
  created: ReminderResponse[];
  skipped: number;
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_AGENDA_WINDOW_DAYS = 92;
const MAX_AGENDA_WINDOW_MS = MAX_AGENDA_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * `RemindersService` (T055): household-scoped Reminder CRUD, the
 * household-wide agenda expansion/merge, and template-pack instantiation.
 * Builds on T053's `computeNextFireAt`/`CreateReminderDto`/`@IsRRule`
 * unchanged -- see the plan's "Endpoint specs" / "Agenda & expansion
 * semantics" / "Instantiation semantics" for the exact per-method contract.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly petsService: PetsService,
  ) {}

  async create(householdId: string, petId: string, dto: CreateReminderDto): Promise<ReminderResponse> {
    await this.petsService.findOne(householdId, petId);

    const parsed = parseRRule(dto.rrule);
    if (!parsed.ok) {
      throw new BadRequestException(parsed.reason);
    }

    const startAt = new Date(dto.startAt);
    const nextFireAt = computeNextFireAt(parsed.value, startAt, startAt, dto.timezone);
    if (nextFireAt === null) {
      throw new BadRequestException("rrule has no occurrence at or after startAt");
    }

    const reminder = await this.prisma.reminder.create({
      data: {
        petId,
        type: dto.type,
        title: dto.title,
        rrule: dto.rrule,
        timezone: dto.timezone,
        startAt,
        nextFireAt,
        ...(dto.medNameAsEntered !== undefined ? { medNameAsEntered: dto.medNameAsEntered } : {}),
      },
    });

    return this.toResponse(reminder);
  }

  async list(householdId: string, petId: string, query: ListRemindersQueryDto): Promise<ReminderListResponse> {
    await this.petsService.findOne(householdId, petId);

    const limit = query.limit ?? DEFAULT_LIST_LIMIT;

    const rows = await this.prisma.reminder.findMany({
      where: { petId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(query.cursor !== undefined ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    // Mirrors `ChecksService.list`: the next-page cursor is the last row
    // actually returned on this page, not the unreturned "extra" row.
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return { items: items.map((row) => this.toResponse(row)), nextCursor };
  }

  async findOne(householdId: string, id: string): Promise<ReminderResponse> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id, pet: { householdId, deletedAt: null } },
    });

    if (!reminder) {
      throw new NotFoundException();
    }

    return this.toResponse(reminder);
  }

  async update(householdId: string, id: string, dto: UpdateReminderDto): Promise<ReminderResponse> {
    const existing = await this.prisma.reminder.findFirst({
      where: { id, pet: { householdId, deletedAt: null } },
    });

    if (!existing) {
      throw new NotFoundException();
    }

    const effectiveStartAt = dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;
    const effectiveTimezone = dto.timezone !== undefined ? dto.timezone : existing.timezone;
    const effectiveRruleStr = dto.rrule !== undefined ? dto.rrule : existing.rrule;
    const scheduleChanged = dto.rrule !== undefined || dto.startAt !== undefined || dto.timezone !== undefined;

    let nextFireAt = existing.nextFireAt;
    if (scheduleChanged) {
      const parsed = parseRRule(effectiveRruleStr);
      if (!parsed.ok) {
        throw new BadRequestException(parsed.reason);
      }

      const computed = computeNextFireAt(parsed.value, effectiveStartAt, effectiveStartAt, effectiveTimezone);
      if (computed === null) {
        throw new BadRequestException("rrule has no occurrence at or after startAt");
      }
      nextFireAt = computed;
    }

    const reminder = await this.prisma.reminder.update({
      where: { id },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.rrule !== undefined ? { rrule: dto.rrule } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.startAt !== undefined ? { startAt: effectiveStartAt } : {}),
        ...(dto.medNameAsEntered !== undefined ? { medNameAsEntered: dto.medNameAsEntered } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(scheduleChanged ? { nextFireAt } : {}),
      },
    });

    return this.toResponse(reminder);
  }

  async remove(householdId: string, id: string): Promise<ReminderResponse> {
    const existing = await this.prisma.reminder.findFirst({
      where: { id, pet: { householdId, deletedAt: null } },
    });

    if (!existing) {
      throw new NotFoundException();
    }

    // Hard delete (plan Risk R7): `Reminder` has no `deletedAt`, and both
    // FKs cascade, so its `ReminderEvent`s are removed along with it.
    const reminder = await this.prisma.reminder.delete({ where: { id } });

    return this.toResponse(reminder);
  }

  async agenda(householdId: string, query: AgendaQueryDto): Promise<AgendaResponse> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (to.getTime() <= from.getTime()) {
      throw new BadRequestException("to must be strictly after from");
    }
    if (to.getTime() - from.getTime() > MAX_AGENDA_WINDOW_MS) {
      throw new BadRequestException(`agenda window must not exceed ${MAX_AGENDA_WINDOW_DAYS} days`);
    }

    if (query.petId !== undefined) {
      await this.petsService.findOne(householdId, query.petId);
    }
    const petFilter = query.petId !== undefined ? { petId: query.petId } : {};

    const reminders = await this.prisma.reminder.findMany({
      where: { active: true, pet: { householdId, deletedAt: null }, ...petFilter },
    });

    // Keyed on `${reminderId}:${dueAt epoch ms}` (plan "merge/dedupe keyed
    // on (reminderId, dueAt-epoch-ms)"). Virtual occurrences are seeded
    // first; materialized events are applied second so an event's status
    // always wins over a virtual placeholder at the same instant, while an
    // orphan event (no matching virtual occurrence) still lands as its own
    // entry.
    const entries = new Map<string, AgendaEntry>();

    for (const reminder of reminders) {
      const parsed = parseRRule(reminder.rrule);
      if (!parsed.ok) {
        continue; // defensive: rrule is validated on write, should not happen
      }

      const occurrences = occurrencesBetween(parsed.value, reminder.startAt, reminder.timezone, from, to);
      for (const dueAt of occurrences) {
        entries.set(`${reminder.id}:${dueAt.getTime()}`, {
          reminderId: reminder.id,
          petId: reminder.petId,
          type: reminder.type,
          title: reminder.title,
          dueAt,
          status: "SCHEDULED",
          virtual: true,
        });
      }
    }

    const events = await this.prisma.reminderEvent.findMany({
      where: {
        dueAt: { gte: from, lte: to },
        reminder: { active: true, pet: { householdId, deletedAt: null }, ...petFilter },
      },
      include: { reminder: true },
    });

    for (const event of events) {
      entries.set(`${event.reminderId}:${event.dueAt.getTime()}`, {
        reminderId: event.reminderId,
        petId: event.reminder.petId,
        type: event.reminder.type,
        title: event.reminder.title,
        dueAt: event.dueAt,
        status: event.status,
        virtual: false,
        eventId: event.id,
      });
    }

    const sortedEntries = [...entries.values()].sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

    return { from, to, entries: sortedEntries };
  }

  /**
   * `POST /reminders/:reminderId/complete` (T060 plan decisions 1-3):
   * materializes/updates the `ReminderEvent` for the EXACT posted `dueAt` to
   * `DONE`, clearing any prior snooze. Idempotent (upsert on
   * `reminderId_dueAt`) -- a double-tap/replay converges to the same
   * terminal state. `dueAt` must be a genuine occurrence of the reminder
   * (`assertOccurrence`) or this throws `400`.
   */
  async completeOccurrence(
    householdId: string,
    reminderId: string,
    dto: CompleteOccurrenceDto,
  ): Promise<AgendaEntry> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, pet: { householdId, deletedAt: null } },
    });
    if (!reminder) {
      throw new NotFoundException();
    }

    const dueAt = new Date(dto.dueAt);
    this.assertOccurrence(reminder, dueAt);

    const event = await this.prisma.reminderEvent.upsert({
      where: { reminderId_dueAt: { reminderId, dueAt } },
      create: { reminderId, dueAt, status: "DONE", completedAt: new Date(), snoozedUntil: null },
      update: { status: "DONE", completedAt: new Date(), snoozedUntil: null },
    });

    return this.toAgendaEntry(reminder, event);
  }

  /**
   * `POST /reminders/:reminderId/snooze` (T060 plan decisions 1-3):
   * materializes/updates the `ReminderEvent` for the EXACT posted `dueAt` to
   * `SNOOZED`/`snoozedUntil`, clearing any prior completion. Never touches
   * `Reminder.nextFireAt` -- re-fire is handled by `refireSnoozed` (decision
   * 4). `snoozeUntil` must be strictly in the future so a snooze never
   * immediately re-fires.
   */
  async snoozeOccurrence(
    householdId: string,
    reminderId: string,
    dto: SnoozeOccurrenceDto,
  ): Promise<AgendaEntry> {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, pet: { householdId, deletedAt: null } },
    });
    if (!reminder) {
      throw new NotFoundException();
    }

    const dueAt = new Date(dto.dueAt);
    this.assertOccurrence(reminder, dueAt);

    const snoozeUntil = new Date(dto.snoozeUntil);
    if (snoozeUntil.getTime() <= Date.now()) {
      throw new BadRequestException("snoozeUntil must be in the future");
    }

    const event = await this.prisma.reminderEvent.upsert({
      where: { reminderId_dueAt: { reminderId, dueAt } },
      create: { reminderId, dueAt, status: "SNOOZED", snoozedUntil: snoozeUntil, completedAt: null },
      update: { status: "SNOOZED", snoozedUntil: snoozeUntil, completedAt: null },
    });

    return this.toAgendaEntry(reminder, event);
  }

  /**
   * `GET /pets/:petId/reminders/template-suggestions` (T059 plan): the
   * read-only review list the wizard renders. Resolves the pack through the
   * IDENTICAL branch logic `instantiateFromTemplate` uses below (same
   * `resolveCareTemplate`/`resolveCareTemplateForPet` choice, same
   * `deriveTemplateStartAt`/`petAgeMonths`, same `templateKey`-in
   * existing-reminder query) so the reviewed list lines up 1:1 with what a
   * subsequent `from-template` POST (with matching `group`/`countryCode`)
   * would create (plan decision 1).
   */
  async templateSuggestions(
    householdId: string,
    petId: string,
    query: TemplateSuggestionsQueryDto,
  ): Promise<CareTemplateSuggestions> {
    const pet = await this.petsService.findOne(householdId, petId);

    const now = new Date();
    const ageMonths = petAgeMonths({ birthDate: pet.birthDate, ageEstimateMonths: pet.ageEstimateMonths }, now);

    const pack =
      query.group !== undefined
        ? resolveCareTemplate(pet.species as Species, resolveLifeStage(pet.species as Species, ageMonths), query.group)
        : resolveCareTemplateForPet({
            species: pet.species as Species,
            ageMonths,
            countryCode: query.countryCode ?? null,
          });

    const existing = await this.prisma.reminder.findMany({
      where: { petId, templateKey: { in: pack.items.map((item) => item.id) } },
      select: { templateKey: true },
    });
    const existingKeys = new Set(existing.map((row) => row.templateKey));

    return {
      species: pack.species,
      lifeStage: pack.lifeStage,
      group: pack.group,
      items: pack.items.map((item) => ({
        templateKey: item.id,
        title: item.title,
        note: item.note,
        reminderType: item.reminderType,
        defaultStartAt:
          deriveTemplateStartAt(
            item,
            { birthDate: pet.birthDate, ageEstimateMonths: pet.ageEstimateMonths },
            now,
          )?.toISOString() ?? null,
        emphasis: item.emphasis,
        alreadyExists: existingKeys.has(item.id),
      })),
    };
  }

  async instantiateFromTemplate(
    householdId: string,
    petId: string,
    dto: InstantiateTemplateDto,
  ): Promise<InstantiateTemplateResponse> {
    const pet = await this.petsService.findOne(householdId, petId);

    const now = new Date();
    const ageMonths = petAgeMonths({ birthDate: pet.birthDate, ageEstimateMonths: pet.ageEstimateMonths }, now);

    const pack =
      dto.group !== undefined
        ? resolveCareTemplate(pet.species as Species, resolveLifeStage(pet.species as Species, ageMonths), dto.group)
        : resolveCareTemplateForPet({
            species: pet.species as Species,
            ageMonths,
            countryCode: dto.countryCode ?? null,
          });

    // T059 plan decision 2: when present, only the listed templateKeys are
    // instantiated and a provided per-item `startAt` overrides the derived
    // default; when absent, behaviour below is byte-for-byte unchanged (all
    // items, derived dates).
    const selectionMap =
      dto.selections !== undefined
        ? new Map(dto.selections.map((selection) => [selection.templateKey, selection]))
        : null;

    const existing = await this.prisma.reminder.findMany({
      where: { petId, templateKey: { in: pack.items.map((item) => item.id) } },
      select: { templateKey: true },
    });
    const existingKeys = new Set(existing.map((row) => row.templateKey));

    const toCreate: Array<{
      petId: string;
      type: string;
      title: string;
      rrule: string;
      timezone: string;
      startAt: Date;
      nextFireAt: Date;
      templateKey: string;
      active: true;
    }> = [];
    let skipped = 0;

    for (const item of pack.items) {
      const selection = selectionMap?.get(item.id);
      if (selectionMap !== null && selection === undefined) {
        continue; // not reviewed/selected by the wizard -- not a "skip", simply not requested
      }

      if (existingKeys.has(item.id)) {
        skipped += 1;
        continue;
      }

      const startAt =
        selection?.startAt !== undefined
          ? new Date(selection.startAt)
          : deriveTemplateStartAt(
              item,
              { birthDate: pet.birthDate, ageEstimateMonths: pet.ageEstimateMonths },
              now,
            );
      if (startAt === null) {
        skipped += 1; // unanchorable PET_AGE item (plan Risk R8)
        continue;
      }

      const parsed = parseRRule(item.rrule);
      if (!parsed.ok) {
        skipped += 1; // defensive: template items are schema-validated at load
        continue;
      }

      const nextFireAt = computeNextFireAt(parsed.value, startAt, startAt, dto.timezone);
      if (nextFireAt === null) {
        skipped += 1; // exhausted rule (plan Risk R5)
        continue;
      }

      toCreate.push({
        petId,
        type: item.reminderType,
        title: item.title,
        rrule: item.rrule,
        timezone: dto.timezone,
        startAt,
        nextFireAt,
        templateKey: item.id,
        active: true,
      });
    }

    const created =
      toCreate.length > 0
        ? await this.prisma.$transaction(toCreate.map((data) => this.prisma.reminder.create({ data })))
        : [];

    return { created: created.map((row) => this.toResponse(row)), skipped };
  }

  /**
   * Validates that `dueAt` is a genuine occurrence of `reminder` (T060 plan
   * decision 2): re-derives occurrences with the SAME `occurrencesBetween`
   * the agenda uses, requiring an epoch-equal match at `[dueAt, dueAt]` --
   * not merely a window-membership check. Throws `BadRequestException`
   * otherwise (invalid rrule, or `dueAt` not on the series).
   */
  private assertOccurrence(reminder: Reminder, dueAt: Date): void {
    const parsed = parseRRule(reminder.rrule);
    if (!parsed.ok) {
      throw new BadRequestException(parsed.reason);
    }

    const occurrences = occurrencesBetween(parsed.value, reminder.startAt, reminder.timezone, dueAt, dueAt);
    const isGenuineOccurrence = occurrences.some((occurrence) => occurrence.getTime() === dueAt.getTime());
    if (!isGenuineOccurrence) {
      throw new BadRequestException("dueAt is not an occurrence of this reminder");
    }
  }

  /** Mirrors `agenda()`'s materialized-event mapping (T060 plan). */
  private toAgendaEntry(reminder: Reminder, event: ReminderEvent): AgendaEntry {
    return {
      reminderId: reminder.id,
      petId: reminder.petId,
      type: reminder.type,
      title: reminder.title,
      dueAt: event.dueAt,
      status: event.status,
      virtual: false,
      eventId: event.id,
    };
  }

  private toResponse(reminder: Reminder): ReminderResponse {
    const response: ReminderResponse = {
      id: reminder.id,
      petId: reminder.petId,
      type: reminder.type,
      title: reminder.title,
      rrule: reminder.rrule,
      timezone: reminder.timezone,
      startAt: reminder.startAt,
      nextFireAt: reminder.nextFireAt,
      active: reminder.active,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    };

    if (reminder.medNameAsEntered !== null) {
      response.medNameAsEntered = reminder.medNameAsEntered;
    }
    if (reminder.templateKey !== null) {
      response.templateKey = reminder.templateKey;
    }

    return response;
  }
}
