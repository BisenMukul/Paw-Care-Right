import { FAMILY_PLAN_PRODUCT_ID } from "@pawcareright/types";
import type { Prisma, PrismaClient } from "@prisma/client";

import { buildChecks, type DemoCheckInput } from "./builders/checks";
import { buildNotes, buildMeals, buildVetVisits, buildWeightSeries, buildActivities, buildSparseActivity, type DemoHealthLogInput } from "./builders/health-logs";
import { buildDemoPets, type DemoPetInput } from "./builders/pets";
import { buildCarePlan, buildMedicationReminder, type DemoReminderInput } from "./builders/reminders";
import { daysFromNow } from "./clock";
import {
  BUDDY_PET_ID,
  CLEO_PET_ID,
  DEMO_HOUSEHOLD_ID,
  DEMO_HOUSEHOLD_NAME,
  DEMO_LOCALE,
  DEMO_REGION,
  DEMO_SUBSCRIPTION_RAW_EVENT_ID,
  FAMILY_DEVICE_ID,
  FAMILY_EMAIL,
  FAMILY_EMPTY_HOUSEHOLD_ID,
  FAMILY_EMPTY_HOUSEHOLD_NAME,
  FAMILY_MEMBERSHIP_ID,
  FAMILY_PUSH_TOKEN,
  FAMILY_USER_ID,
  LUNA_PET_ID,
  OWNER_DEVICE_ID,
  OWNER_EMAIL,
  OWNER_MEMBERSHIP_ID,
  OWNER_PUSH_TOKEN,
  OWNER_USER_ID,
} from "./constants";
import { MEAL_NOTES, NOTE_TEXTS, VET_VISIT_CONTENT } from "./content";

/** The full demo graph as plain data — composed once by `buildDemo`, written once by `persistDemo`. */
export interface DemoModel {
  pets: DemoPetInput[];
  healthLogs: DemoHealthLogInput[];
  reminders: DemoReminderInput[];
  checks: DemoCheckInput[];
  subscriptionExpiresAt: Date;
}

const SUBSCRIPTION_VALID_DAYS = 300;

/**
 * Composes every pure builder into one plain `DemoModel` (plan #9). Buddy
 * (rich): full 60-day weight trend, all 7 activity types (5 dated today),
 * 2 notes/meals, 2 vet visits, a rich care plan + a medication reminder,
 * and 4 checks spanning REASSURE/MONITOR/VET_24H/EMERGENCY_NOW. Cleo
 * (moderate): a shorter weight trend, 1 note/meal/vet-visit, a moderate
 * care plan, and 2 checks (VET_SOON + FALLBACK). Luna (sparse/new): 1
 * weight point, 1 minimal activity, and a sparse (future-only) care plan.
 */
export function buildDemo(now: Date): DemoModel {
  const pets = buildDemoPets(now);
  const buddy = pets.find((pet) => pet.id === BUDDY_PET_ID);
  const cleo = pets.find((pet) => pet.id === CLEO_PET_ID);
  const luna = pets.find((pet) => pet.id === LUNA_PET_ID);
  /* istanbul ignore next -- defensive; buildDemoPets always returns these 3 fixed ids */
  if (!buddy || !cleo || !luna) {
    throw new Error("demo seed: buildDemoPets did not return Buddy/Cleo/Luna");
  }

  const healthLogs: DemoHealthLogInput[] = [
    ...buildWeightSeries(buddy.id, now, 9, 60, 29200, 100),
    ...buildActivities(buddy.id, now),
    ...buildNotes(buddy.id, now, [
      { text: NOTE_TEXTS.buddyPlayful, daysBack: 0 },
      { text: NOTE_TEXTS.buddyGroomed, daysBack: 10 },
    ]),
    ...buildMeals(buddy.id, now, [
      { note: MEAL_NOTES.buddyBreakfast, daysBack: 0, portionGrams: 220 },
      { note: MEAL_NOTES.buddyDinner, daysBack: 1 },
    ]),
    ...buildVetVisits(buddy.id, now, [
      { ...VET_VISIT_CONTENT.buddyAnnual, daysBack: 45 },
      { ...VET_VISIT_CONTENT.buddyDental, daysBack: 20 },
    ]),

    ...buildWeightSeries(cleo.id, now, 4, 30, 4155, 15),
    ...buildNotes(cleo.id, now, [{ text: NOTE_TEXTS.cleoQuiet, daysBack: 2 }]),
    ...buildMeals(cleo.id, now, [{ note: MEAL_NOTES.cleoBreakfast, daysBack: 0 }]),
    ...buildVetVisits(cleo.id, now, [{ ...VET_VISIT_CONTENT.cleoCheckup, daysBack: 25 }]),

    ...buildWeightSeries(luna.id, now, 1, 0, 1800, 0),
    ...buildSparseActivity(luna.id, now),
  ];

  const reminders: DemoReminderInput[] = [
    ...buildCarePlan(buddy, now, "rich"),
    buildMedicationReminder(buddy, now),
    ...buildCarePlan(cleo, now, "moderate"),
    ...buildCarePlan(luna, now, "sparse"),
  ];

  const checks = buildChecks(now, { buddyId: buddy.id, cleoId: cleo.id, createdById: OWNER_USER_ID });

  return { pets, healthLogs, reminders, checks, subscriptionExpiresAt: daysFromNow(now, SUBSCRIPTION_VALID_DAYS) };
}

/**
 * Deletes ONLY the demo subgraph, by fixed id / known demo email, in
 * FK-safe order (plan #9 / Risk R3): Subscription rows first (belt-and-
 * braces — both Households below already cascade-delete them), then
 * `DEMO_HOUSEHOLD_ID` (cascades Pets -> SymptomChecks/TriageResults/
 * CheckFollowUps/Reminders/ReminderEvents/HealthLogs, and Memberships),
 * then the empty `FAMILY_EMPTY_HOUSEHOLD_ID`, then the two demo Users
 * (cascades their Devices/RefreshTokens) — Users must be deleted LAST
 * because `Household.owner` is `onDelete: Restrict`. Every `deleteMany`
 * filters by a fixed demo id or the two demo emails — this NEVER touches
 * `dev@pawcareright.local` or any other non-demo row.
 */
export async function wipeDemo(prisma: PrismaClient): Promise<void> {
  await prisma.subscription.deleteMany({ where: { rcAppUserId: { in: [OWNER_USER_ID, FAMILY_USER_ID] } } });
  await prisma.household.deleteMany({ where: { id: DEMO_HOUSEHOLD_ID } });
  await prisma.household.deleteMany({ where: { id: FAMILY_EMPTY_HOUSEHOLD_ID } });
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, FAMILY_EMAIL] } } });
}

/**
 * Writes the full demo graph (plan #9) with explicit fixed ids/timestamps.
 * Called only after `wipeDemo`, so plain `create` (never `upsert`) is
 * correct and simplest.
 */
export async function persistDemo(prisma: PrismaClient, model: DemoModel): Promise<void> {
  await prisma.user.create({ data: { id: OWNER_USER_ID, email: OWNER_EMAIL, locale: DEMO_LOCALE, region: DEMO_REGION } });
  await prisma.user.create({ data: { id: FAMILY_USER_ID, email: FAMILY_EMAIL, locale: DEMO_LOCALE, region: DEMO_REGION } });

  await prisma.household.create({ data: { id: DEMO_HOUSEHOLD_ID, name: DEMO_HOUSEHOLD_NAME, ownerId: OWNER_USER_ID } });
  await prisma.household.create({
    data: { id: FAMILY_EMPTY_HOUSEHOLD_ID, name: FAMILY_EMPTY_HOUSEHOLD_NAME, ownerId: FAMILY_USER_ID },
  });

  await prisma.membership.create({
    data: { id: OWNER_MEMBERSHIP_ID, userId: OWNER_USER_ID, householdId: DEMO_HOUSEHOLD_ID, role: "OWNER" },
  });
  await prisma.membership.create({
    data: { id: FAMILY_MEMBERSHIP_ID, userId: FAMILY_USER_ID, householdId: DEMO_HOUSEHOLD_ID, role: "MEMBER" },
  });

  await prisma.device.create({
    data: { id: OWNER_DEVICE_ID, userId: OWNER_USER_ID, expoPushToken: OWNER_PUSH_TOKEN, platform: "ios" },
  });
  await prisma.device.create({
    data: { id: FAMILY_DEVICE_ID, userId: FAMILY_USER_ID, expoPushToken: FAMILY_PUSH_TOKEN, platform: "android" },
  });

  for (const pet of model.pets) {
    await prisma.pet.create({ data: { ...pet } });
  }

  for (const log of model.healthLogs) {
    await prisma.healthLog.create({
      data: {
        petId: log.petId,
        kind: log.kind,
        valueJson: log.valueJson as unknown as Prisma.InputJsonValue,
        occurredAt: log.occurredAt,
      },
    });
  }

  for (const reminder of model.reminders) {
    await prisma.reminder.create({
      data: {
        petId: reminder.petId,
        type: reminder.type,
        title: reminder.title,
        rrule: reminder.rrule,
        timezone: reminder.timezone,
        startAt: reminder.startAt,
        nextFireAt: reminder.nextFireAt,
        active: reminder.active,
        ...(reminder.templateKey !== undefined ? { templateKey: reminder.templateKey } : {}),
        ...(reminder.medNameAsEntered !== undefined ? { medNameAsEntered: reminder.medNameAsEntered } : {}),
        ...(reminder.medDoseAsEntered !== undefined ? { medDoseAsEntered: reminder.medDoseAsEntered } : {}),
        events: {
          create: reminder.events.map((event) => ({
            dueAt: event.dueAt,
            status: event.status,
            ...(event.completedAt !== undefined ? { completedAt: event.completedAt } : {}),
          })),
        },
      },
    });
  }

  for (const check of model.checks) {
    const created = await prisma.symptomCheck.create({
      data: {
        petId: check.petId,
        createdById: check.createdById,
        status: check.status,
        category: check.category,
        intakeJson: check.intake as unknown as Prisma.InputJsonValue,
        redFlagHit: check.redFlagHit,
        redFlagRuleId: check.redFlagRuleId,
        redFlagPayloadKey: check.redFlagPayloadKey,
        failureReason: check.failureReason,
        createdAt: check.createdAt,
        startedAt: check.createdAt,
        completedAt: check.completedAt,
      },
    });

    await prisma.triageResult.create({
      data: {
        checkId: created.id,
        urgency: check.result.urgency,
        confidence: check.result.confidence,
        resultJson: check.result.resultJson as unknown as Prisma.InputJsonValue,
        modelId: check.result.modelId,
        promptVersion: check.result.promptVersion,
      },
    });

    if (check.followUp) {
      await prisma.checkFollowUp.create({
        data: {
          checkId: created.id,
          response: check.followUp.response,
          escalatedTier: check.followUp.escalatedTier,
        },
      });
    }
  }

  await prisma.subscription.create({
    data: {
      rcAppUserId: OWNER_USER_ID,
      householdId: DEMO_HOUSEHOLD_ID,
      entitlement: "PREMIUM",
      plan: FAMILY_PLAN_PRODUCT_ID,
      status: "active",
      expiresAt: model.subscriptionExpiresAt,
      rawEventJson: { eventId: DEMO_SUBSCRIPTION_RAW_EVENT_ID, type: "INITIAL_PURCHASE", demo: true } as unknown as Prisma.InputJsonValue,
    },
  });
}
