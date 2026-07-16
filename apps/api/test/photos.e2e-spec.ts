import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";
import type { Job, Queue } from "bullmq";
import { QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import sharp from "sharp";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { AppConfigService } from "../src/config/app-config.service";
import { deriveMainKey, deriveThumbKey, originalKeyPrefix } from "../src/photos/photos.constants";
import { StorageService } from "../src/storage/storage.service";
import { IMAGES_QUEUE, type ImagesJobData } from "../src/workers/images.contract";
import {
  cleanupUsers,
  createOwnerContext,
  createUser,
  mintAccessToken,
  overrideCheckRunner,
  resolveJwtService,
  type AuthedContext,
} from "./factories";

const JOB_WAIT_TIMEOUT_MS = 30_000;

/**
 * Real MinIO + real BullMQ round-trip: the acceptance-critical suite for
 * T023. `ImagesProcessor` (registered in-process via `@Processor`, see plan
 * R1) actually consumes the enqueued job here — no mocking of storage or the
 * queue anywhere in this file.
 */
describe("Photos (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;
  let storage: StorageService;
  let queue: Queue<ImagesJobData>;
  let queueEvents: QueueEvents;
  let queueEventsConnection: Redis;

  const userIds: string[] = [];
  const objectKeysToCleanup: string[] = [];

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
    storage = app.get(StorageService);
    queue = app.get(getQueueToken(IMAGES_QUEUE));

    await storage.ensureBucket();

    const config = app.get(AppConfigService);
    queueEventsConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    queueEvents = new QueueEvents(IMAGES_QUEUE, { connection: queueEventsConnection });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    for (const key of objectKeysToCleanup) {
      await storage.deleteObject(key).catch(() => undefined);
    }
    await cleanupUsers(prisma, userIds);

    await queueEvents.close();
    await queueEventsConnection.quit();
    await prisma.$disconnect();
    await app.close();
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  async function createPet(ctx: AuthedContext, name = "Fido"): Promise<string> {
    const res = await ctx.authedAgent("post", "/v1/pets").send({ species: "DOG", name });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function buildExifJpegFixture(): Promise<Buffer> {
    return sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .jpeg()
      .withExif({ IFD0: { Software: "pawcareright-test", Copyright: "t" } })
      .toBuffer();
  }

  describe("unauthenticated", () => {
    it("POST photo-upload-url with no token → 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/pets/some-pet-id/photo-upload-url")
        .send({ contentType: "image/jpeg", contentLength: 1000 });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("POST photo-upload-confirm with no token → 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/pets/some-pet-id/photo-upload-confirm")
        .send({ key: "pets/some-pet-id/original/x.jpg" });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("presign validation", () => {
    it("wrong content-type rejected at presign → 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
        .send({ contentType: "application/pdf", contentLength: 1000 });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("oversize declared length rejected at presign → 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
        .send({ contentType: "image/jpeg", contentLength: 10 * 1024 * 1024 });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("cross-household scoping", () => {
    it("presign on another household's pet → 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");

      const res = await ownerB
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
        .send({ contentType: "image/jpeg", contentLength: 1000 });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });

  describe("confirm validation", () => {
    it("foreign-namespace key rejected → 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`)
        .send({ key: `${originalKeyPrefix("some-other-pet-id")}x.jpg` });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("well-formed but never-uploaded key → 404 NOT_FOUND", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const key = `${originalKeyPrefix(petId)}never-uploaded.jpg`;

      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`).send({ key });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("path-traversal key → 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const key = `${originalKeyPrefix(petId)}../../other-pet/main/x.jpg`;

      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`).send({ key });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("happy path — full upload → resize → rendition round-trip", () => {
    it("presign → PUT → confirm → worker produces EXIF-stripped 1600/320 renditions and updates Pet.photoKey", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx, "Rex");
      const fixture = await buildExifJpegFixture();

      const fixtureMeta = await sharp(fixture).metadata();
      expect(fixtureMeta.exif).toBeInstanceOf(Buffer);

      const presignRes = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
        .send({ contentType: "image/jpeg", contentLength: fixture.length });
      expect(presignRes.status).toBe(200);
      const { uploadUrl, key } = presignRes.body as { uploadUrl: string; key: string };
      expect(key.startsWith(originalKeyPrefix(petId))).toBe(true);
      objectKeysToCleanup.push(key, deriveMainKey(key), deriveThumbKey(key));

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: fixture,
        headers: { "Content-Type": "image/jpeg" },
      });
      expect(putRes.ok).toBe(true);

      const confirmRes = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`).send({ key });
      expect(confirmRes.status).toBe(202);
      expect(confirmRes.body).toEqual({ queued: true, jobId: key });
      const { jobId } = confirmRes.body as { jobId: string };

      const job = (await queue.getJob(jobId)) as Job<ImagesJobData>;
      expect(job).toBeDefined();
      await job.waitUntilFinished(queueEvents, JOB_WAIT_TIMEOUT_MS);

      const mainKey = deriveMainKey(key);
      const thumbKey = deriveThumbKey(key);

      const petRes = await ctx.authedAgent("get", `/v1/pets/${petId}`);
      expect(petRes.status).toBe(200);
      expect(petRes.body.photoKey).toBe(mainKey);

      const mainBuf = await storage.getObject(mainKey);
      const thumbBuf = await storage.getObject(thumbKey);

      const mainMeta = await sharp(mainBuf).metadata();
      expect(mainMeta.format).toBe("jpeg");
      expect(mainMeta.width).toBeLessThanOrEqual(1600);
      expect(mainMeta.height).toBeLessThanOrEqual(1600);
      expect(mainMeta.exif).toBeUndefined();

      const thumbMeta = await sharp(thumbBuf).metadata();
      expect(thumbMeta.width).toBeLessThanOrEqual(320);
      expect(thumbMeta.height).toBeLessThanOrEqual(320);
      expect(thumbMeta.exif).toBeUndefined();
    }, JOB_WAIT_TIMEOUT_MS + 10_000);
  });

  describe("photo-view-urls", () => {
    it("no token → 401 UNAUTHORIZED", async () => {
      const res = await request(app.getHttpServer())
        .post("/v1/pets/some-pet-id/photo-view-urls")
        .send({ keys: [`${originalKeyPrefix("some-pet-id")}x.jpg`] });

      expect(res.status).toBe(401);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("UNAUTHORIZED");
    });

    it("cross-household pet → 404 NOT_FOUND", async () => {
      const ownerA = await owner();
      const ownerB = await owner();
      const petId = await createPet(ownerA, "A's Dog");
      const key = `${originalKeyPrefix(petId)}x.jpg`;

      const res = await ownerB.authedAgent("post", `/v1/pets/${petId}/photo-view-urls`).send({ keys: [key] });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });

    it("a key outside the pet's original-upload namespace → 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-view-urls`)
        .send({ keys: [`${originalKeyPrefix("some-other-pet-id")}x.jpg`] });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("an empty keys array → 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);

      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-view-urls`).send({ keys: [] });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("a path-traversal key → 400 VALIDATION_FAILED", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx);
      const key = `${originalKeyPrefix(petId)}../evil.jpg`;

      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-view-urls`).send({ keys: [key] });

      expect(res.status).toBe(400);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
    });

    it("real round-trip: presign → PUT → confirm → worker renditions, then view-urls returns working GET URLs for both renditions", async () => {
      const ctx = await owner();
      const petId = await createPet(ctx, "Milo");
      const fixture = await buildExifJpegFixture();

      const presignRes = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
        .send({ contentType: "image/jpeg", contentLength: fixture.length });
      expect(presignRes.status).toBe(200);
      const { uploadUrl, key } = presignRes.body as { uploadUrl: string; key: string };
      objectKeysToCleanup.push(key, deriveMainKey(key), deriveThumbKey(key));

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: fixture,
        headers: { "Content-Type": "image/jpeg" },
      });
      expect(putRes.ok).toBe(true);

      const confirmRes = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`).send({ key });
      expect(confirmRes.status).toBe(202);
      const { jobId } = confirmRes.body as { jobId: string };
      const job = (await queue.getJob(jobId)) as Job<ImagesJobData>;
      await job.waitUntilFinished(queueEvents, JOB_WAIT_TIMEOUT_MS);

      const viewRes = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-view-urls`).send({ keys: [key] });

      expect(viewRes.status).toBe(200);
      expect(viewRes.body).toEqual({
        items: [{ key, thumbUrl: expect.any(String), mainUrl: expect.any(String) }],
      });
      const { thumbUrl, mainUrl } = viewRes.body.items[0] as { thumbUrl: string; mainUrl: string };

      const thumbGetRes = await fetch(thumbUrl);
      expect(thumbGetRes.status).toBe(200);
      expect(thumbGetRes.headers.get("content-type")).toContain("image");

      const mainGetRes = await fetch(mainUrl);
      expect(mainGetRes.status).toBe(200);
      expect(mainGetRes.headers.get("content-type")).toContain("image");
    }, JOB_WAIT_TIMEOUT_MS + 10_000);
  });

  describe("no household for the caller", () => {
    it("presign for a bare user with no household → 404 NOT_FOUND", async () => {
      const bareUser = await createUser(prisma);
      userIds.push(bareUser.id);
      const token = mintAccessToken(jwtService, bareUser.id);

      const res = await request(app.getHttpServer())
        .post("/v1/pets/some-pet-id/photo-upload-url")
        .set("Authorization", `Bearer ${token}`)
        .send({ contentType: "image/jpeg", contentLength: 1000 });

      expect(res.status).toBe(404);
      expect(errorResponseSchema.parse(res.body).error.code).toBe("NOT_FOUND");
    });
  });
});
