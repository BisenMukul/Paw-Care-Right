import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { errorResponseSchema, HEALTH_LOG_PHOTO_KEYS_MAX } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { MAX_UPLOAD_BYTES } from "../src/photos/photos.constants";
import { cleanupUsers, createOwnerContext, createPet, overrideCheckRunner, resolveJwtService, type AuthedContext } from "./factories";
import { FUZZ_SEED, hostilePhotoKeys, mulberry32, typeConfusionValues } from "./fuzz/seeded-corpus";

/**
 * T096 Phase D: presign/confirm/view-urls fuzz-ish suite, modelled on
 * `photos.e2e-spec.ts`. Deliberately infra-light per plan step 13: no MinIO
 * round-trips, no BullMQ worker, no `QueueEvents` listener -- every case
 * here is rejected by DTO validation or the namespace guard before storage
 * is ever touched (the Nest app + Postgres for pets/households is enough).
 * The hostile-key corpus used here is filtered to the subset that carries a
 * real path-segment escape (`confinedButNeverUploaded: false`) -- the other
 * subset legitimately reaches `storage.objectExists()` and 404s (a
 * different, already-tested class; see `seeded-corpus.ts`'s doc-comment and
 * `photos-key-fuzz.spec.ts`), which would pull in the MinIO dependency this
 * suite is designed to avoid.
 */
describe("Photos presign/confirm/view-urls fuzz (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let jwtService: JwtService;

  const userIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = new PrismaClient();
    jwtService = resolveJwtService(app);
  });

  afterAll(async () => {
    await cleanupUsers(prisma, userIds);
    await prisma.$disconnect();
    await app.close();
  });

  const owner = (): Promise<AuthedContext> => createOwnerContext(app, prisma, jwtService, userIds);

  async function petFor(ctx: AuthedContext, name = "Fido"): Promise<string> {
    const pet = await createPet(prisma, ctx.household.id, { name });
    return pet.id;
  }

  function expectValidationFailed(res: { status: number; body: unknown }): void {
    expect(res.status).toBe(400);
    expect(errorResponseSchema.parse(res.body).error.code).toBe("VALIDATION_FAILED");
  }

  it("hostile contentType values are rejected at presign", async () => {
    const ctx = await owner();
    const petId = await petFor(ctx);

    const hostileContentTypes: unknown[] = [
      "image/jpeg; charset=utf-8",
      "IMAGE/JPEG",
      "image/svg+xml",
      "text/html",
      "image/jpeg ",
      ["image/jpeg"],
      {},
      null,
      undefined,
    ];

    for (const contentType of hostileContentTypes) {
      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
        .send({ contentType, contentLength: 1000 });
      expectValidationFailed(res);
    }
  });

  it("hostile contentLength values are rejected at presign", async () => {
    const ctx = await owner();
    const petId = await petFor(ctx);

    const hostileLengths: unknown[] = [0, -1, MAX_UPLOAD_BYTES + 1, 1.5, "1000", true, null, undefined];

    for (const contentLength of hostileLengths) {
      const res = await ctx
        .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
        .send({ contentType: "image/jpeg", contentLength });
      expectValidationFailed(res);
    }

    // `1e400` cannot be produced via JSON.stringify (it would serialize as
    // `null`) -- sent as a raw body so body-parser's JSON.parse actually
    // overflows the numeral to `Infinity` server-side.
    const infinityRes = await ctx
      .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
      .set("Content-Type", "application/json")
      .send('{"contentType":"image/jpeg","contentLength":1e400}');
    expectValidationFailed(infinityRes);
  });

  it("hostile key types are rejected at confirm", async () => {
    const ctx = await owner();
    const petId = await petFor(ctx);

    const hostileKeys = typeConfusionValues().filter((v) => v !== "x".repeat(10_000)); // covered by the seeded-key test

    for (const key of hostileKeys) {
      const res = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`).send({ key });
      expectValidationFailed(res);
    }
  });

  it("every seeded hostile key (real path-segment escape) is rejected at confirm and view-urls, never 500, never a presigned URL", async () => {
    const ctx = await owner();
    const petId = await petFor(ctx);
    const rng = mulberry32(FUZZ_SEED);
    const entries = hostilePhotoKeys(petId, rng).filter((entry) => !entry.confinedButNeverUploaded);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const confirmRes = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`).send({ key: entry.key });
      expect(confirmRes.status).not.toBe(500);
      expectValidationFailed(confirmRes);
      expect(JSON.stringify(confirmRes.body)).not.toContain("http");

      const viewRes = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-view-urls`).send({ keys: [entry.key] });
      expect(viewRes.status).not.toBe(500);
      expectValidationFailed(viewRes);
      expect(JSON.stringify(viewRes.body)).not.toContain("http");
    }
  });

  it("a sibling pet's legitimate key is rejected even inside the same household", async () => {
    const ctx = await owner();
    const petAId = await petFor(ctx, "A");
    const petBId = await petFor(ctx, "B");

    const presignA = await ctx
      .authedAgent("post", `/v1/pets/${petAId}/photo-upload-url`)
      .send({ contentType: "image/jpeg", contentLength: 1000 });
    expect(presignA.status).toBe(200);
    const { key: petAKey } = presignA.body as { key: string };

    const confirmRes = await ctx.authedAgent("post", `/v1/pets/${petBId}/photo-upload-confirm`).send({ key: petAKey });
    expectValidationFailed(confirmRes);

    const viewRes = await ctx.authedAgent("post", `/v1/pets/${petBId}/photo-view-urls`).send({ keys: [petAKey] });
    expectValidationFailed(viewRes);
  });

  it("cross-household callers cannot presign, confirm, or view (always 404, never 403/400)", async () => {
    const ownerA = await owner();
    const ownerB = await owner();
    const petId = await petFor(ownerA, "A's Dog");

    const presignRes = await ownerB
      .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
      .send({ contentType: "image/jpeg", contentLength: 1000 });
    expect(presignRes.status).toBe(404);
    expect(errorResponseSchema.parse(presignRes.body).error.code).toBe("NOT_FOUND");

    const confirmRes = await ownerB
      .authedAgent("post", `/v1/pets/${petId}/photo-upload-confirm`)
      .send({ key: `pets/${petId}/original/x.jpg` });
    expect(confirmRes.status).toBe(404);
    expect(errorResponseSchema.parse(confirmRes.body).error.code).toBe("NOT_FOUND");

    const viewRes = await ownerB
      .authedAgent("post", `/v1/pets/${petId}/photo-view-urls`)
      .send({ keys: [`pets/${petId}/original/x.jpg`] });
    expect(viewRes.status).toBe(404);
    expect(errorResponseSchema.parse(viewRes.body).error.code).toBe("NOT_FOUND");
  });

  it("two presigns for the same pet never collide", async () => {
    const ctx = await owner();
    const petId = await petFor(ctx);

    // 25 total presign calls, issued in batches of 5 concurrent requests
    // each (5 batches) rather than all 25 at once: this sandbox's Node/HTTP
    // stack was empirically observed (scratchpad probe, see the T096
    // journal entry) to intermittently ECONNRESET above ~5 concurrent
    // supertest requests against the in-process test server, independent of
    // Postgres (max_connections=100, plenty of headroom) or any app-level
    // logic -- an environment ceiling, not a security property. Batching
    // preserves the full 25-call, no-collision assertion the plan calls
    // for while still exercising real concurrency within each batch.
    const BATCH_SIZE = 5;
    const TOTAL_CALLS = 25;
    const results: Array<{ status: number; body: unknown }> = [];
    for (let i = 0; i < TOTAL_CALLS; i += BATCH_SIZE) {
      const batch = await Promise.all(
        Array.from({ length: BATCH_SIZE }, () =>
          ctx.authedAgent("post", `/v1/pets/${petId}/photo-upload-url`).send({ contentType: "image/jpeg", contentLength: 1000 }),
        ),
      );
      results.push(...batch);
    }

    const keys = results.map((res) => {
      expect(res.status).toBe(200);
      return (res.body as { key: string }).key;
    });

    expect(new Set(keys).size).toBe(25);
    for (const key of keys) {
      expect(key.startsWith(`pets/${petId}/original/`)).toBe(true);
    }
  });

  it("presigned URLs are short-lived and scoped, and never carry the raw secret access key", async () => {
    const ctx = await owner();
    const petId = await petFor(ctx);

    const res = await ctx
      .authedAgent("post", `/v1/pets/${petId}/photo-upload-url`)
      .send({ contentType: "image/jpeg", contentLength: 1000 });
    expect(res.status).toBe(200);
    const { uploadUrl, key } = res.body as { uploadUrl: string; key: string };

    const url = new URL(uploadUrl);
    expect(url.pathname).toContain(key);
    expect(Number(url.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(300);
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
    // The credential is present (needed to verify the signature), but the
    // raw secret access key itself must never appear in the URL.
    expect(uploadUrl).not.toContain("pawcareright-dev-secret");
  });

  it("view-urls rejects an over-cap key array (unbounded-work guard)", async () => {
    const ctx = await owner();
    const petId = await petFor(ctx);
    const keys = Array.from({ length: HEALTH_LOG_PHOTO_KEYS_MAX + 1 }, (_, i) => `pets/${petId}/original/${i}.jpg`);

    const res = await ctx.authedAgent("post", `/v1/pets/${petId}/photo-view-urls`).send({ keys });
    expectValidationFailed(res);
  });
});
