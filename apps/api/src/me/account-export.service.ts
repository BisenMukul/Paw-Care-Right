import { Injectable, Logger } from "@nestjs/common";
import {
  ACCOUNT_EXPORT_SCHEMA_VERSION,
  accountExportSchema,
  EXPORT_LINK_TTL_SECONDS,
} from "@bombaypetcompany/types";

import { AppConfigService } from "../config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

const EXPORT_CONTENT_TYPE = "application/json";

/**
 * Builds the caller's own full-data export bundle (T091 plan D4, AC2's
 * schema gate). Every query is EXPLICITLY ownership-filtered (never an
 * unfiltered `findMany`) -- household-scoped rows use the caller's OWN
 * `householdId` (resolved from their sole `Membership`), user-scoped rows
 * (checks, chat threads) use `createdById: userId`. A schema-validation
 * failure fails the job (never writes an unvalidated bundle to S3) -- the
 * `AccountExport` row is marked `FAILED` with a short, content-free reason
 * and the error is rethrown so BullMQ retries.
 */
@Injectable()
export class AccountExportService {
  private readonly logger = new Logger(AccountExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: AppConfigService,
  ) {}

  async build(exportId: string, userId: string): Promise<void> {
    try {
      const bundle = await this.assembleBundle(userId);
      const parsed = accountExportSchema.parse(bundle);

      const objectKey = `exports/${userId}/${exportId}.json`;
      await this.storage.putObject(
        objectKey,
        Buffer.from(JSON.stringify(parsed)),
        EXPORT_CONTENT_TYPE,
      );

      await this.prisma.accountExport.update({
        where: { id: exportId },
        data: { status: "DONE", objectKey, completedAt: new Date() },
      });

      await this.logDeliveryStub(userId, exportId, objectKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "export build failed";
      this.logger.error({ event: "account_export_build_failed", userId, exportId });
      await this.prisma.accountExport.update({
        where: { id: exportId },
        // `message` here is a zod/schema/infra error message -- never user
        // content (intake/photo/chat text) -- but is still bounded so it
        // never balloons into a log/DB blob.
        data: { status: "FAILED", failureReason: message.slice(0, 300) },
      });
      throw error;
    }
  }

  /**
   * Delivery stub (plan step 19): a link stub in the dev log ONLY -- no
   * email provider exists in this stack yet.
   * Founder follow-up (T091): no email provider exists in the stack yet --
   * replace this dev-log link stub with real delivery before launch.
   */
  private async logDeliveryStub(userId: string, exportId: string, objectKey: string): Promise<void> {
    if (this.config.nodeEnv === "production") {
      // A working presigned link in production log aggregation is itself a
      // data leak -- ids only, no url.
      this.logger.log({ event: "account_export_ready", userId, exportId, objectKey });
      return;
    }

    const url = await this.storage.getPresignedGetUrl({
      key: objectKey,
      expiresInSeconds: EXPORT_LINK_TTL_SECONDS,
    });
    this.logger.log({ event: "account_export_ready", userId, exportId, objectKey, url });
  }

  /**
   * Returns the raw (pre-validation) bundle shape. Typed `unknown` rather
   * than the exported `AccountExport` type on purpose: `accountExportSchema
   * .parse(...)` in `build()` immediately above is the single source of
   * truth for the validated shape -- duplicating it here as a hand-written
   * TS interface would be exactly the "never hand-write a duplicate
   * interface" anti-pattern CLAUDE §6 forbids.
   */
  private async assembleBundle(userId: string): Promise<unknown> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("account-export: user not found");
    }

    const membership = await this.prisma.membership.findFirst({ where: { userId } });
    if (!membership) {
      throw new Error("account-export: no membership for user");
    }
    const { householdId, role } = membership;

    const household = await this.prisma.household.findUnique({ where: { id: householdId } });
    if (!household) {
      throw new Error("account-export: household not found");
    }

    const pets = await this.prisma.pet.findMany({ where: { householdId, deletedAt: null } });
    const petIds = pets.map((pet) => pet.id);

    const checks = await this.prisma.symptomCheck.findMany({
      where: { createdById: userId },
      include: { result: true, followUp: true },
      orderBy: { createdAt: "asc" },
    });

    const healthLogs = await this.prisma.healthLog.findMany({
      where: { petId: { in: petIds } },
      orderBy: { occurredAt: "asc" },
    });

    const reminders = await this.prisma.reminder.findMany({
      where: { petId: { in: petIds } },
      include: { events: true },
      orderBy: { createdAt: "asc" },
    });

    const chatThreads = await this.prisma.chatThread.findMany({
      where: { createdById: userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    const notificationPrefs = await this.prisma.userNotificationPrefs.findUnique({ where: { userId } });

    const subscription = await this.prisma.subscription.findUnique({ where: { rcAppUserId: userId } });

    const devices = await this.prisma.device.findMany({ where: { userId } });

    const photoKeys = new Set<string>();
    for (const pet of pets) {
      if (pet.photoKey !== null) photoKeys.add(pet.photoKey);
    }
    for (const check of checks) {
      for (const key of check.photoKeys) photoKeys.add(key);
    }
    for (const log of healthLogs) {
      for (const key of log.photoKeys) photoKeys.add(key);
    }

    const photos = await Promise.all(
      [...photoKeys].map(async (key) => ({
        key,
        downloadUrl: await this.storage.getPresignedGetUrl({ key, expiresInSeconds: EXPORT_LINK_TTL_SECONDS }),
      })),
    );

    const now = new Date();

    return {
      schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      linkExpiresAt: new Date(now.getTime() + EXPORT_LINK_TTL_SECONDS * 1000).toISOString(),
      user: {
        id: user.id,
        email: user.email,
        locale: user.locale,
        region: user.region,
        createdAt: user.createdAt.toISOString(),
      },
      household: { id: household.id, name: household.name, yourRole: role },
      pets: pets.map((pet) => ({
        id: pet.id,
        species: pet.species,
        breedSlug: pet.breedSlug,
        name: pet.name,
        sex: pet.sex,
        neutered: pet.neutered,
        birthDate: pet.birthDate ? pet.birthDate.toISOString() : null,
        ageEstimateMonths: pet.ageEstimateMonths,
        weightGrams: pet.weightGrams,
        photoKey: pet.photoKey,
        createdAt: pet.createdAt.toISOString(),
      })),
      checks: checks.map((check) => ({
        id: check.id,
        petId: check.petId,
        status: check.status,
        category: check.category,
        intakeJson: check.intakeJson,
        photoKeys: check.photoKeys,
        redFlagHit: check.redFlagHit,
        createdAt: check.createdAt.toISOString(),
        // `TriageResult.resultJson` IS the full stored triage result (see
        // `checks.service.ts`'s persist code) -- no separate merge needed.
        ...(check.result ? { result: check.result.resultJson } : {}),
        ...(check.followUp
          ? {
              followUp: {
                response: check.followUp.response,
                ...(check.followUp.escalatedTier !== null
                  ? { escalatedTier: check.followUp.escalatedTier }
                  : {}),
              },
            }
          : {}),
      })),
      healthLogs: healthLogs.map((log) => ({
        id: log.id,
        petId: log.petId,
        kind: log.kind,
        valueJson: log.valueJson,
        photoKeys: log.photoKeys,
        occurredAt: log.occurredAt.toISOString(),
      })),
      reminders: reminders.map((reminder) => ({
        id: reminder.id,
        petId: reminder.petId,
        type: reminder.type,
        title: reminder.title,
        rrule: reminder.rrule,
        timezone: reminder.timezone,
        active: reminder.active,
        events: reminder.events.map((event) => ({
          id: event.id,
          dueAt: event.dueAt.toISOString(),
          status: event.status,
          completedAt: event.completedAt ? event.completedAt.toISOString() : null,
          snoozedUntil: event.snoozedUntil ? event.snoozedUntil.toISOString() : null,
        })),
      })),
      chatThreads: chatThreads.map((thread) => ({
        id: thread.id,
        petId: thread.petId,
        createdAt: thread.createdAt.toISOString(),
        messages: thread.messages.map((message) => ({
          role: message.role,
          content: message.content,
          status: message.status,
          createdAt: message.createdAt.toISOString(),
        })),
      })),
      notificationPrefs: notificationPrefs
        ? {
            disabledTypes: notificationPrefs.disabledTypes,
            quietHours:
              notificationPrefs.quietStart && notificationPrefs.quietEnd && notificationPrefs.timezone
                ? {
                    start: notificationPrefs.quietStart,
                    end: notificationPrefs.quietEnd,
                    timezone: notificationPrefs.timezone,
                  }
                : null,
          }
        : null,
      subscription: subscription
        ? {
            entitlement: subscription.entitlement,
            plan: subscription.plan,
            status: subscription.status,
            expiresAt: subscription.expiresAt ? subscription.expiresAt.toISOString() : null,
          }
        : null,
      devices: devices.map((device) => ({
        platform: device.platform,
        lastSeenAt: device.lastSeenAt.toISOString(),
        createdAt: device.createdAt.toISOString(),
      })),
      photos,
    };
  }
}
