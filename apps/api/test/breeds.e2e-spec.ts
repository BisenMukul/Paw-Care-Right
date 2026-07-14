import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getOptionsToken } from "@nestjs/throttler";
import { errorResponseSchema } from "@pawcareright/types";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { overrideCheckRunner } from "./factories";

// Public, unauthenticated, cached breed lookup/autocomplete
// (`GET /v1/breeds?species=&q=`). No auth guard bypass needed: `@Public()`
// on `BreedsController` already exempts it from `JwtAuthGuard`. Per
// Amendment A0 the production route keeps the real global 100/60s
// `ThrottlerGuard` — it is NOT `@SkipThrottle()`d — so every case in the
// "Breeds (e2e)" block below runs against the real limiter, well under its
// ceiling. Only the dedicated "p95" block below needs (and gets) its own,
// separately-compiled `TestingModule` with the throttler neutralized so its
// 100+ same-IP timing requests don't 429.
describe("Breeds (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(Test.createTestingModule({ imports: [AppModule] })).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("public, no auth", () => {
    it("GET /v1/breeds?species=DOG with no Authorization header → 200", async () => {
      const res = await request(app.getHttpServer()).get("/v1/breeds").query({ species: "DOG" });

      expect(res.status).toBe(200);
    });
  });

  describe("validation", () => {
    it("missing species → 400 VALIDATION_FAILED", async () => {
      const res = await request(app.getHttpServer()).get("/v1/breeds");

      expect(res.status).toBe(400);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("VALIDATION_FAILED");
    });

    it("invalid species (species=FISH) → 400 VALIDATION_FAILED", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/breeds")
        .query({ species: "FISH" });

      expect(res.status).toBe(400);
      const parsed = errorResponseSchema.parse(res.body);
      expect(parsed.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("happy path", () => {
    it("empty q → 200 with the full species list", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/breeds")
        .query({ species: "DOG" });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(20);
    });

    it("GET /v1/breeds?species=DOG&q=gsd → 200, first result is German Shepherd Dog", async () => {
      const res = await request(app.getHttpServer())
        .get("/v1/breeds")
        .query({ species: "DOG", q: "gsd" });

      expect(res.status).toBe(200);
      expect(res.body[0].slug).toBe("german-shepherd");
      expect(res.body[0].name).toBe("German Shepherd Dog");
    });
  });
});

// Dedicated app instance + p95 latency measurement. Amendment A0 calls for
// this spec's own `TestingModule` to neutralize the global `ThrottlerGuard`
// for its 100+ same-IP requests. The literal technique the plan describes —
// `.overrideProvider(ThrottlerGuard)` against the `APP_GUARD` registration —
// is a documented Nest internal no-op: `DependenciesScanner` rewrites every
// `{ provide: APP_GUARD, useClass: X }` registration's token to a
// per-registration random UUID string during module scanning (`scanner.js`
// `insertProvider`), specifically so multiple global guards can coexist
// under the same `APP_GUARD` constant. That means neither `APP_GUARD` nor
// the `ThrottlerGuard` class itself is ever a matchable override target in
// `TestingModule` (verified empirically: overriding a class registered this
// way silently does not take effect — the real guard still runs). The
// functionally equivalent, verified-working substitute — same intent
// ("this spec's own TestingModule stops throttling from tripping", nothing
// touched outside this file, production route/config untouched) — is
// overriding the `ThrottlerModuleOptions` value the real `ThrottlerGuard`
// reads its limit from (`getOptionsToken()`, a normal, non-rewritten DI
// token owned by `ThrottlerModule.forRoot`, registered independently of the
// `APP_GUARD` array) with a very high limit for this compiled module only.
describe("Breeds (e2e) — p95 latency", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(getOptionsToken())
        .useValue([{ name: "default", ttl: 60_000, limit: 1_000_000 }]),
    ).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("p95 latency for a cached GET /v1/breeds?species=DOG&q=gsd is under 30ms", async () => {
    const WARMUP_REQUESTS = 10;
    const SAMPLE_REQUESTS = 100;

    for (let i = 0; i < WARMUP_REQUESTS; i += 1) {
      const res = await request(app.getHttpServer())
        .get("/v1/breeds")
        .query({ species: "DOG", q: "gsd" });
      expect(res.status).toBe(200);
    }

    const durationsMs: number[] = [];
    for (let i = 0; i < SAMPLE_REQUESTS; i += 1) {
      const start = process.hrtime.bigint();
      const res = await request(app.getHttpServer())
        .get("/v1/breeds")
        .query({ species: "DOG", q: "gsd" });
      const end = process.hrtime.bigint();

      expect(res.status).toBe(200);
      durationsMs.push(Number(end - start) / 1_000_000);
    }

    const sorted = [...durationsMs].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(0.95 * SAMPLE_REQUESTS)]!;

    // JUSTIFIED: perf-test diagnostic only (never shipped), reporting the
    // measured p95 for this AC.
    // eslint-disable-next-line no-console
    console.info(`breeds p95 latency over ${SAMPLE_REQUESTS} samples: ${p95.toFixed(2)}ms`);

    expect(p95).toBeLessThan(30);
  });
});
