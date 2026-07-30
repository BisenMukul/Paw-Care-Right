import { z } from "zod";

import { chatMessageRoleSchema, chatMessageStatusSchema } from "./chat";
import { checkStatusSchema } from "./check-status";
import { followUpSchema } from "./check";
import { healthLogKindSchema } from "./health-log";
import { notificationPrefsSchema } from "./notification-prefs";
import { sexSchema, speciesSchema } from "./pet";
import { reminderEventStatusSchema } from "./reminder";
import { triageResultSchema } from "./triage";

/**
 * The caller's own full-data export bundle (T091 plan D4). Every array is
 * scoped to rows the caller can legitimately see: their one household's pets/
 * health logs/reminders, plus rows the caller themselves created (checks,
 * chat threads). This schema is the LAST gate before a bundle is written to
 * S3 (`AccountExportService.build` — a validation failure fails the job,
 * never writes an unvalidated bundle) and the schema AC1/AC2's e2e suite
 * parses the finished object against.
 *
 * `.strict()` everywhere (no unknown top-level keys) — plan "Tests to
 * write" AC2 requires an extra top-level key to be rejected.
 *
 * Deliberately excludes: any other household member's identity (only
 * `yourRole` is exposed for the household), `expoPushToken` (devices),
 * `rawEventJson` (subscription) — CLAUDE §6/T091 plan D4/D5.
 */
export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1;

const exportUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    locale: z.string(),
    region: z.string(),
    createdAt: z.string().datetime(),
  })
  .strict();

const exportHouseholdRoleSchema = z.enum(["OWNER", "MEMBER"]);

const exportHouseholdSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    yourRole: exportHouseholdRoleSchema,
  })
  .strict();

const exportPetSchema = z
  .object({
    id: z.string(),
    species: speciesSchema,
    breedSlug: z.string().nullable(),
    name: z.string(),
    sex: sexSchema,
    neutered: z.boolean(),
    birthDate: z.string().datetime().nullable(),
    ageEstimateMonths: z.number().int().nullable(),
    weightGrams: z.number().int().nullable(),
    photoKey: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

const exportCheckSchema = z
  .object({
    id: z.string(),
    petId: z.string(),
    status: checkStatusSchema,
    category: z.string(),
    intakeJson: z.unknown(),
    photoKeys: z.array(z.string()),
    redFlagHit: z.boolean(),
    createdAt: z.string().datetime(),
    result: triageResultSchema.optional(),
    followUp: followUpSchema.optional(),
  })
  .strict();

const exportHealthLogSchema = z
  .object({
    id: z.string(),
    petId: z.string(),
    kind: healthLogKindSchema,
    valueJson: z.unknown(),
    photoKeys: z.array(z.string()),
    occurredAt: z.string().datetime(),
  })
  .strict();

const exportReminderEventSchema = z
  .object({
    id: z.string(),
    dueAt: z.string().datetime(),
    status: reminderEventStatusSchema,
    completedAt: z.string().datetime().nullable(),
    snoozedUntil: z.string().datetime().nullable(),
  })
  .strict();

const exportReminderSchema = z
  .object({
    id: z.string(),
    petId: z.string(),
    type: z.string(),
    title: z.string(),
    rrule: z.string(),
    timezone: z.string(),
    active: z.boolean(),
    events: z.array(exportReminderEventSchema),
  })
  .strict();

const exportChatMessageSchema = z
  .object({
    role: chatMessageRoleSchema,
    content: z.string(),
    status: chatMessageStatusSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

const exportChatThreadSchema = z
  .object({
    id: z.string(),
    petId: z.string(),
    createdAt: z.string().datetime(),
    messages: z.array(exportChatMessageSchema),
  })
  .strict();

/** Mirrors `Prisma.SubscriptionEntitlement`; NEVER `rawEventJson` (plan D4/R5 — billing payload is never exported). */
const exportSubscriptionEntitlementSchema = z.enum(["FREE", "PREMIUM"]);

const exportSubscriptionSchema = z
  .object({
    entitlement: exportSubscriptionEntitlementSchema,
    plan: z.string().nullable(),
    status: z.string(),
    expiresAt: z.string().datetime().nullable(),
  })
  .strict();

/**
 * NEVER `expoPushToken` (plan D4/R5 — device push credential is never
 * exported). `appVersion`/`otaUpdateId` added by T117 (F10) — user-linked
 * machine version identifiers only, no PII (docs/store-privacy.md §2).
 */
const exportDeviceSchema = z
  .object({
    platform: z.string(),
    lastSeenAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    appVersion: z.string().nullable(),
    otaUpdateId: z.string().nullable(),
  })
  .strict();

const exportPhotoSchema = z
  .object({
    key: z.string(),
    downloadUrl: z.string().url(),
  })
  .strict();

export const accountExportSchema = z
  .object({
    schemaVersion: z.literal(ACCOUNT_EXPORT_SCHEMA_VERSION),
    generatedAt: z.string().datetime(),
    linkExpiresAt: z.string().datetime(),
    user: exportUserSchema,
    household: exportHouseholdSchema,
    pets: z.array(exportPetSchema),
    checks: z.array(exportCheckSchema),
    healthLogs: z.array(exportHealthLogSchema),
    reminders: z.array(exportReminderSchema),
    chatThreads: z.array(exportChatThreadSchema),
    notificationPrefs: notificationPrefsSchema.nullable(),
    subscription: exportSubscriptionSchema.nullable(),
    devices: z.array(exportDeviceSchema),
    photos: z.array(exportPhotoSchema),
  })
  .strict();
export type AccountExport = z.infer<typeof accountExportSchema>;
