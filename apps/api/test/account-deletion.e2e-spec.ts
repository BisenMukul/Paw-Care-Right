import { createHash, randomBytes, randomUUID } from "node:crypto";

import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@bombaypetcompany/types";
import { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import { QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { AppConfigService } from "../src/config/app-config.service";
import { deriveMainKey, deriveThumbKey } from "../src/photos/photos.constants";
import { StorageService } from "../src/storage/storage.service";
import { ACCOUNT_DELETION_JOB_NAME, ACCOUNT_DELETION_QUEUE } from "../src/workers/account-deletion.contract";
import {
  addMembership,
  cleanupUsers,
  createOwnerContext,
  createPet,
  createReferralGrant,
  createSubscription,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

const JOB_WAIT_TIMEOUT_MS = 30_000;

/**
 * Real Postgres + real MinIO + real BullMQ cascade proof (T091 plan AC1).
 * `AccountDeletionProcessor` (registered in-process via `@Processor`, same
 * pattern as `test/photos.e2e-spec.ts`'s `ImagesProcessor`) actually
 * consumes the enqueued sweep job here -- no mocking of storage, the queue,
 * or the erasure cascade anywhere in this file.
 */
describe("Account deletion (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let storage: StorageService;
  let deletionQueue: Queue;
  let queueEvents: QueueEvents;
  let queueEventsConnection: Redis;

  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    storage = app.get(StorageService);
    deletionQueue = app.get(getQueueToken(ACCOUNT_DELETION_QUEUE));

    await storage.ensureBucket();

    const config = app.get(AppConfigService);
    queueEventsConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    queueEvents = new QueueEvents(ACCOUNT_DELETION_QUEUE, { connection: queueEventsConnection });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    await cleanupUsers(prisma, userIds);
    await queueEvents.close();
    await queueEventsConnection.quit();
    await prisma.$disconnect();
    await app.close();
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  /** Enqueues a real sweep job onto the real queue and waits for it to finish (mirrors photos.e2e-spec.ts's job.waitUntilFinished pattern). */
  async function runDeletionSweep(): Promise<void> {
    const job = await deletionQueue.add(ACCOUNT_DELETION_JOB_NAME, {});
    await job.waitUntilFinished(queueEvents, JOB_WAIT_TIMEOUT_MS);
  }

  /** Seeds a real RefreshToken row and returns the RAW token (hashed the same way RefreshTokenService does). */
  async function issueRefreshTokenRow(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.refreshToken.create({
      data: {
        userId,
        familyId: randomUUID(),
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return rawToken;
  }

  async function forceDueNow(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { deletionScheduledAt: new Date(Date.now() - 1000) },
    });
  }

  describe("sole-owner deletion: every DB row and every S3 key for the account is gone after the job", () => {
    it("proves the full cascade (AC1)", async () => {
      const ctx = await owner();
      const petA = await createPet(prisma, ctx.household.id, { name: "Rex" });
      const petB = await createPet(prisma, ctx.household.id, { name: "Milo" });

      const petAOriginal = `pets/${petA.id}/original/${randomUUID()}.jpg`;
      const petAMain = deriveMainKey(petAOriginal);
      const petAThumb = deriveThumbKey(petAOriginal);
      const petBOriginal = `pets/${petB.id}/original/${randomUUID()}.jpg`;
      const petBMain = deriveMainKey(petBOriginal);

      await storage.putObject(petAOriginal, Buffer.from("a"), "image/jpeg");
      await storage.putObject(petAMain, Buffer.from("a"), "image/jpeg");
      await storage.putObject(petAThumb, Buffer.from("a"), "image/jpeg");
      await storage.putObject(petBOriginal, Buffer.from("b"), "image/jpeg");
      await storage.putObject(petBMain, Buffer.from("b"), "image/jpeg");
      await prisma.pet.update({ where: { id: petA.id }, data: { photoKey: petAMain } });

      const check = await prisma.symptomCheck.create({
        data: {
          petId: petA.id,
          createdById: ctx.user.id,
          category: "vomiting",
          intakeJson: { category: "vomiting", answers: [] },
          photoKeys: [petAOriginal],
          status: "DONE",
        },
      });
      await prisma.triageResult.create({
        data: {
          checkId: check.id,
          urgency: "MONITOR",
          confidence: "medium",
          resultJson: { urgency: "MONITOR" },
          modelId: "test-model",
          promptVersion: "v1",
        },
      });
      await prisma.checkFollowUp.create({ data: { checkId: check.id, response: "better" } });

      const healthLog = await prisma.healthLog.create({
        data: {
          petId: petB.id,
          kind: "NOTE",
          valueJson: { text: "ate well" },
          photoKeys: [petBOriginal],
          occurredAt: new Date(),
        },
      });

      const reminder = await prisma.reminder.create({
        data: {
          petId: petA.id,
          type: "VACCINE",
          title: "Rabies",
          rrule: "FREQ=YEARLY",
          timezone: "UTC",
          startAt: new Date(),
          nextFireAt: new Date(Date.now() + 86_400_000),
        },
      });
      const reminderEvent = await prisma.reminderEvent.create({
        data: { reminderId: reminder.id, dueAt: new Date(Date.now() + 86_400_000) },
      });

      const thread = await prisma.chatThread.create({
        data: { petId: petA.id, createdById: ctx.user.id },
      });
      await prisma.chatMessage.create({
        data: { threadId: thread.id, role: "USER", content: "hello" },
      });
      await prisma.chatMessage.create({
        data: { threadId: thread.id, role: "ASSISTANT", content: "hi there" },
      });

      const auditByCheck = await prisma.aiAuditLog.create({
        data: { surface: "CHECK", checkId: check.id, promptVersion: "v1", modelId: "test-model", status: "OK" },
      });
      const auditByThread = await prisma.aiAuditLog.create({
        data: { surface: "CHAT", threadId: thread.id, promptVersion: "v1", modelId: "test-model", status: "OK" },
      });

      const device = await prisma.device.create({
        data: { userId: ctx.user.id, expoPushToken: `ExponentPushToken[${randomUUID()}]`, platform: "ios" },
      });
      const rawRefreshToken = await issueRefreshTokenRow(ctx.user.id);
      await prisma.userNotificationPrefs.create({ data: { userId: ctx.user.id, disabledTypes: [] } });
      await createSubscription(prisma, {
        rcAppUserId: ctx.user.id,
        householdId: ctx.household.id,
        entitlement: "PREMIUM",
      });
      const invite = await prisma.householdInvite.create({
        data: {
          code: randomUUID(),
          householdId: ctx.household.id,
          createdById: ctx.user.id,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      const accountExport = await prisma.accountExport.create({ data: { userId: ctx.user.id } });
      // T108 AC6b: a referral grant this user RECEIVED must be erased with them.
      const referralGrant = await createReferralGrant(prisma, {
        userId: ctx.user.id,
        inviteId: invite.id,
      });

      const deleteRes = await ctx.authedAgent("delete", "/v1/me");
      expect(deleteRes.status).toBe(200);
      expect(typeof deleteRes.body.deletionScheduledAt).toBe("string");

      await forceDueNow(ctx.user.id);
      await runDeletionSweep();

      expect(await prisma.user.count({ where: { id: ctx.user.id } })).toBe(0);
      expect(await prisma.household.count({ where: { id: ctx.household.id } })).toBe(0);
      expect(await prisma.membership.count({ where: { userId: ctx.user.id } })).toBe(0);
      expect(await prisma.pet.count({ where: { id: { in: [petA.id, petB.id] } } })).toBe(0);
      expect(await prisma.symptomCheck.count({ where: { id: check.id } })).toBe(0);
      expect(await prisma.triageResult.count({ where: { checkId: check.id } })).toBe(0);
      expect(await prisma.checkFollowUp.count({ where: { checkId: check.id } })).toBe(0);
      expect(await prisma.reminder.count({ where: { id: reminder.id } })).toBe(0);
      expect(await prisma.reminderEvent.count({ where: { id: reminderEvent.id } })).toBe(0);
      expect(await prisma.healthLog.count({ where: { id: healthLog.id } })).toBe(0);
      expect(await prisma.chatThread.count({ where: { id: thread.id } })).toBe(0);
      expect(await prisma.chatMessage.count({ where: { threadId: thread.id } })).toBe(0);
      expect(await prisma.device.count({ where: { id: device.id } })).toBe(0);
      expect(await prisma.refreshToken.count({ where: { userId: ctx.user.id } })).toBe(0);
      expect(await prisma.userNotificationPrefs.count({ where: { userId: ctx.user.id } })).toBe(0);
      expect(await prisma.householdInvite.count({ where: { id: invite.id } })).toBe(0);
      expect(await prisma.subscription.count({ where: { rcAppUserId: ctx.user.id } })).toBe(0);
      expect(await prisma.accountExport.count({ where: { id: accountExport.id } })).toBe(0);
      expect(
        await prisma.aiAuditLog.count({ where: { id: { in: [auditByCheck.id, auditByThread.id] } } }),
      ).toBe(0);
      // T108 AC6b: the deleted user's received referral grant is gone too.
      expect(await prisma.referralGrant.count({ where: { id: referralGrant.id } })).toBe(0);

      expect(await storage.objectExists(petAOriginal)).toBe(false);
      expect(await storage.objectExists(petAMain)).toBe(false);
      expect(await storage.objectExists(petAThumb)).toBe(false);
      expect(await storage.objectExists(petBOriginal)).toBe(false);
      expect(await storage.objectExists(petBMain)).toBe(false);

      // Sanity: the old refresh token is dead (soft-delete revoked it AND
      // the row is gone entirely after the hard cascade).
      const refreshRes = await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({ refreshToken: rawRefreshToken });
      expect(refreshRes.status).toBe(401);
    }, JOB_WAIT_TIMEOUT_MS + 15_000);
  });

  describe("grace period is enforced: a user whose window has not elapsed survives the sweep", () => {
    it("survives while deletionScheduledAt is in the future, then is erased once it's in the past", async () => {
      const ctx = await owner();
      const pet = await createPet(prisma, ctx.household.id);
      const originalKey = `pets/${pet.id}/original/${randomUUID()}.jpg`;
      await storage.putObject(originalKey, Buffer.from("x"), "image/jpeg");

      const deleteRes = await ctx.authedAgent("delete", "/v1/me");
      expect(deleteRes.status).toBe(200);

      // deletionScheduledAt is ~30 days out (ACCOUNT_DELETION_GRACE_DAYS) --
      // NOT forced into the past here.
      await runDeletionSweep();

      expect(await prisma.user.count({ where: { id: ctx.user.id } })).toBe(1);
      expect(await prisma.pet.count({ where: { id: pet.id } })).toBe(1);
      expect(await storage.objectExists(originalKey)).toBe(true);

      await forceDueNow(ctx.user.id);
      await runDeletionSweep();

      expect(await prisma.user.count({ where: { id: ctx.user.id } })).toBe(0);
      expect(await prisma.pet.count({ where: { id: pet.id } })).toBe(0);
      expect(await storage.objectExists(originalKey)).toBe(false);
    }, JOB_WAIT_TIMEOUT_MS * 2 + 15_000);
  });

  describe("member deletion removes the member's own rows but leaves the shared household intact", () => {
    it("D1a: member's checks + user gone, household/pets/owner data survive, shared photo key survives, own-only key does not", async () => {
      const ownerCtx = await owner();

      // Manually build a MEMBER context inside the owner's household (rather
      // than `createMemberContext`, which provisions a SEPARATE household
      // for the member) -- this test needs the member to share the OWNER's
      // household.
      const memberRow = await prisma.user.create({
        data: { email: `member-${randomUUID()}@bombaypetcompany.local`, locale: "en-US", region: "US" },
      });
      userIds.push(memberRow.id);
      await addMembership(prisma, { userId: memberRow.id, householdId: ownerCtx.household.id, role: "MEMBER" });
      const memberToken = jwtService.sign({ sub: memberRow.id });
      const memberAgent = (method: "get" | "post" | "delete" | "patch" | "put", path: string) =>
        request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${memberToken}`);

      const pet = await createPet(prisma, ownerCtx.household.id, { name: "Shared Pet" });

      // Shared original key: the pet's CURRENT main photo AND the member's
      // check both reference it (plan risk R7 / the shared-key non-vacuous
      // mutation).
      const sharedOriginal = `pets/${pet.id}/original/${randomUUID()}-shared.jpg`;
      const sharedMain = deriveMainKey(sharedOriginal);
      const sharedThumb = deriveThumbKey(sharedOriginal);
      await storage.putObject(sharedOriginal, Buffer.from("s"), "image/jpeg");
      await storage.putObject(sharedMain, Buffer.from("s"), "image/jpeg");
      await storage.putObject(sharedThumb, Buffer.from("s"), "image/jpeg");
      await prisma.pet.update({ where: { id: pet.id }, data: { photoKey: sharedMain } });

      // Member-only key: referenced ONLY by the member's own check.
      const ownOnlyOriginal = `pets/${pet.id}/original/${randomUUID()}-own.jpg`;
      const ownOnlyMain = deriveMainKey(ownOnlyOriginal);
      const ownOnlyThumb = deriveThumbKey(ownOnlyOriginal);
      await storage.putObject(ownOnlyOriginal, Buffer.from("o"), "image/jpeg");
      await storage.putObject(ownOnlyMain, Buffer.from("o"), "image/jpeg");
      await storage.putObject(ownOnlyThumb, Buffer.from("o"), "image/jpeg");

      const memberCheck = await prisma.symptomCheck.create({
        data: {
          petId: pet.id,
          createdById: memberRow.id,
          category: "skin-itch",
          intakeJson: { category: "skin-itch", answers: [] },
          photoKeys: [sharedOriginal, ownOnlyOriginal],
          status: "DONE",
        },
      });

      const ownerCheck = await prisma.symptomCheck.create({
        data: {
          petId: pet.id,
          createdById: ownerCtx.user.id,
          category: "vomiting",
          intakeJson: { category: "vomiting", answers: [] },
          photoKeys: [],
          status: "DONE",
        },
      });

      const ownerHealthLog = await prisma.healthLog.create({
        data: { petId: pet.id, kind: "NOTE", valueJson: { text: "fine" }, occurredAt: new Date() },
      });

      // F7 (checker review): pin member-path ChatThread deletion with an
      // explicit test seed + assertion -- `eraseUserOnly`'s own
      // `chatThread.deleteMany` is the line under test here (redundant with
      // `ChatThread.createdBy`'s `onDelete: Cascade` today, per the
      // checker's P2 probe, but pinned anyway so a future FK change can't
      // silently make this the next F1).
      const memberThread = await prisma.chatThread.create({ data: { petId: pet.id, createdById: memberRow.id } });
      await prisma.chatMessage.create({ data: { threadId: memberThread.id, role: "USER", content: "hi" } });

      const deleteRes = await memberAgent("delete", "/v1/me");
      expect(deleteRes.status).toBe(200);

      await forceDueNow(memberRow.id);
      await runDeletionSweep();

      // Member is gone.
      expect(await prisma.user.count({ where: { id: memberRow.id } })).toBe(0);
      expect(await prisma.symptomCheck.count({ where: { id: memberCheck.id } })).toBe(0);
      expect(await prisma.chatThread.count({ where: { id: memberThread.id } })).toBe(0);
      expect(await prisma.chatMessage.count({ where: { threadId: memberThread.id } })).toBe(0);

      // Household + owner's data survive.
      expect(await prisma.household.count({ where: { id: ownerCtx.household.id } })).toBe(1);
      expect(await prisma.pet.count({ where: { id: pet.id } })).toBe(1);
      expect(await prisma.symptomCheck.count({ where: { id: ownerCheck.id } })).toBe(1);
      expect(await prisma.healthLog.count({ where: { id: ownerHealthLog.id } })).toBe(1);

      // Shared key survives; the member's own-only key does not.
      expect(await storage.objectExists(sharedOriginal)).toBe(true);
      expect(await storage.objectExists(sharedMain)).toBe(true);
      expect(await storage.objectExists(sharedThumb)).toBe(true);
      expect(await storage.objectExists(ownOnlyOriginal)).toBe(false);
      expect(await storage.objectExists(ownOnlyMain)).toBe(false);
      expect(await storage.objectExists(ownOnlyThumb)).toBe(false);
    }, JOB_WAIT_TIMEOUT_MS + 15_000);
  });

  describe("F1 regression (checker review): a user who left a shared household still gets fully erased", () => {
    it("join -> author a check -> leave (new solo household) -> delete account -> the orphaned check + its audit row are erased and the user row is gone", async () => {
      // The exact shipped journey the checker's P1 probe replicated: join a
      // shared household, run a symptom check there (createdById = the
      // member), then use the shipped `POST /households/leave` (which
      // re-provisions a FRESH solo household for the leaver and drops the
      // old membership) -- leaving the check behind with
      // `createdById = userId` on a PET THAT IS NO LONGER IN THE CALLER'S
      // (new) HOUSEHOLD. Before the F1 fix, `eraseFullHousehold` collected
      // checks by `petId` of the household being erased only, missed this
      // row entirely, and `tx.user.delete` then threw P2003 against
      // `SymptomCheck.createdBy`'s `onDelete: Restrict` FK -- silently,
      // forever (every subsequent sweep repeats the same throw).
      const ownerCtx = await owner();
      const memberRow = await prisma.user.create({
        data: { email: `leaver-${randomUUID()}@bombaypetcompany.local`, locale: "en-US", region: "US" },
      });
      userIds.push(memberRow.id);
      await addMembership(prisma, { userId: memberRow.id, householdId: ownerCtx.household.id, role: "MEMBER" });
      const memberToken = jwtService.sign({ sub: memberRow.id });
      const memberAgent = (method: "get" | "post" | "delete" | "patch" | "put", path: string) =>
        request(app.getHttpServer())[method](path).set("Authorization", `Bearer ${memberToken}`);

      const sharedPet = await createPet(prisma, ownerCtx.household.id, { name: "Household A's Pet" });

      const orphanedCheck = await prisma.symptomCheck.create({
        data: {
          petId: sharedPet.id,
          createdById: memberRow.id,
          category: "vomiting",
          intakeJson: { category: "vomiting", answers: [] },
          photoKeys: [],
          status: "DONE",
        },
      });
      // D3: an AiAuditLog row keyed to the orphaned check -- proves the F1
      // fix also collects it (mirrors the plan's D3 ordering requirement)
      // rather than leaving it to age out on its own 90-day retention sweep.
      const orphanedAudit = await prisma.aiAuditLog.create({
        data: { surface: "CHECK", checkId: orphanedCheck.id, promptVersion: "v1", modelId: "test-model", status: "OK" },
      });

      const leaveRes = await memberAgent("post", "/v1/households/leave");
      expect(leaveRes.status).toBe(200);
      const newHouseholdId = leaveRes.body.householdId as string;
      expect(newHouseholdId).not.toBe(ownerCtx.household.id);

      const deleteRes = await memberAgent("delete", "/v1/me");
      expect(deleteRes.status).toBe(200);

      await forceDueNow(memberRow.id);
      await runDeletionSweep();

      // The user is actually gone -- the P2003 throw (pre-fix) would have
      // rolled back the whole transaction, leaving this row untouched.
      expect(await prisma.user.count({ where: { id: memberRow.id } })).toBe(0);
      expect(await prisma.membership.count({ where: { userId: memberRow.id } })).toBe(0);
      // The orphaned check (and its D3 audit row) are erased too.
      expect(await prisma.symptomCheck.count({ where: { id: orphanedCheck.id } })).toBe(0);
      expect(await prisma.aiAuditLog.count({ where: { id: orphanedAudit.id } })).toBe(0);
      // Household A (the one the member left) and its pet are UNTOUCHED --
      // this erasure must never reach past the caller's own rows.
      expect(await prisma.household.count({ where: { id: ownerCtx.household.id } })).toBe(1);
      expect(await prisma.pet.count({ where: { id: sharedPet.id } })).toBe(1);
      // The fresh solo household created by `leaveHousehold` is also gone
      // (it was the FULL_HOUSEHOLD being erased).
      expect(await prisma.household.count({ where: { id: newHouseholdId } })).toBe(0);
    }, JOB_WAIT_TIMEOUT_MS + 15_000);
  });

  describe("an owner with other household members is refused with 409 and nothing is scheduled", () => {
    it("D1c: 409 CONFLICT, deletionScheduledAt stays null, refresh token stays valid", async () => {
      const ctx = await owner();
      const otherMember = await prisma.user.create({
        data: { email: `co-member-${randomUUID()}@bombaypetcompany.local`, locale: "en-US", region: "US" },
      });
      userIds.push(otherMember.id);
      await addMembership(prisma, { userId: otherMember.id, householdId: ctx.household.id, role: "MEMBER" });
      const rawRefreshToken = await issueRefreshTokenRow(ctx.user.id);

      const res = await ctx.authedAgent("delete", "/v1/me");

      expect(res.status).toBe(409);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("CONFLICT");

      const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id } });
      expect(user.deletionScheduledAt).toBeNull();

      const refreshRes = await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({ refreshToken: rawRefreshToken });
      expect(refreshRes.status).toBe(200);
    });
  });

  describe("T108 AC6b: a referral grant survives its counterparty's erasure", () => {
    it("DELETE /me removes the caller's ReferralGrant rows; a counterparty's erasure nulls counterpartyUserId but preserves the surviving user's earned grant", async () => {
      const recipient = await owner();
      const counterparty = await owner();

      // `recipient` earned a grant with `counterparty` as the other party --
      // this must survive counterparty's own account deletion untouched
      // except for the nulled FK (D11: "earned grace is never revoked by
      // someone else's erasure").
      const survivingGrant = await createReferralGrant(prisma, {
        userId: recipient.user.id,
        counterpartyUserId: counterparty.user.id,
      });
      // `counterparty` also received their OWN grant from this same accept --
      // that row belongs to counterparty and must be erased along with them.
      const counterpartyOwnGrant = await createReferralGrant(prisma, {
        userId: counterparty.user.id,
        counterpartyUserId: recipient.user.id,
      });

      const deleteRes = await counterparty.authedAgent("delete", "/v1/me");
      expect(deleteRes.status).toBe(200);

      await forceDueNow(counterparty.user.id);
      await runDeletionSweep();

      expect(await prisma.user.count({ where: { id: counterparty.user.id } })).toBe(0);
      // counterparty's own received grant is erased with them.
      expect(await prisma.referralGrant.count({ where: { id: counterpartyOwnGrant.id } })).toBe(0);

      // recipient's earned grant SURVIVES, with the FK nulled (not deleted).
      const survived = await prisma.referralGrant.findUnique({ where: { id: survivingGrant.id } });
      expect(survived).not.toBeNull();
      expect(survived?.counterpartyUserId).toBeNull();
      expect(survived?.userId).toBe(recipient.user.id);
      expect(survived?.startsAt.getTime()).toBe(survivingGrant.startsAt.getTime());
      expect(survived?.expiresAt.getTime()).toBe(survivingGrant.expiresAt.getTime());
    }, JOB_WAIT_TIMEOUT_MS + 15_000);
  });

  describe("soft delete revokes every refresh token and removes devices", () => {
    it("POST /auth/refresh with the old token fails and device.count === 0", async () => {
      const ctx = await owner();
      await prisma.device.create({
        data: { userId: ctx.user.id, expoPushToken: `ExponentPushToken[${randomUUID()}]`, platform: "android" },
      });
      const rawRefreshToken = await issueRefreshTokenRow(ctx.user.id);

      const res = await ctx.authedAgent("delete", "/v1/me");
      expect(res.status).toBe(200);

      const refreshRes = await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({ refreshToken: rawRefreshToken });
      expect(refreshRes.status).toBe(401);

      expect(await prisma.device.count({ where: { userId: ctx.user.id } })).toBe(0);
    });
  });
});
