import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { overrideCheckRunner } from "./factories";
import { TestThrowController } from "./test-throw.controller";
import { ThrottleTestController } from "./throttle-test.controller";

// Exercises the transport-security baseline added by T017 (helmet, CORS,
// throttling, body-size limits) via its own isolated Nest app instance —
// same pattern as every other `*.e2e-spec.ts`. Its `ThrottlerStorage` is
// per-instance and in-memory, so the tight test-only throttle route
// (`ThrottleTestController`, limit 2) can never bleed into other suites,
// and the global `default` throttler (100/60s) is never hit here either.
describe("Security baseline (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await overrideCheckRunner(
      Test.createTestingModule({
        imports: [AppModule],
        controllers: [ThrottleTestController, TestThrowController],
      }),
    ).compile();

    // `{ bodyParser: false }` mirrors main.ts exactly, so `configureApp`'s
    // 1 MB parsers are the only ones active and the 413 boundary is exact.
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("sets baseline security headers on responses", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");

    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-dns-prefetch-control"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("echoes ACAO only for the allowed web-admin origin", async () => {
    const allowed = await request(app.getHttpServer())
      .get("/v1/health")
      .set("Origin", "http://localhost:3001");

    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3001");

    const disallowed = await request(app.getHttpServer())
      .get("/v1/health")
      .set("Origin", "https://evil.example");

    expect(disallowed.status).toBe(200);
    expect(disallowed.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects an over-limit request body with 413", async () => {
    const oversizedName = "x".repeat(2 * 1024 * 1024);

    const res = await request(app.getHttpServer())
      .post("/v1/__test__/echo")
      .send({ name: oversizedName });

    expect(res.status).toBe(413);
  });

  it("throttled test route returns 429 + Retry-After + RATE_LIMITED envelope after the class limit", async () => {
    const first = await request(app.getHttpServer()).get("/v1/__test__/throttle/ping");
    const second = await request(app.getHttpServer()).get("/v1/__test__/throttle/ping");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const third = await request(app.getHttpServer()).get("/v1/__test__/throttle/ping");

    expect(third.status).toBe(429);
    expect(third.headers["retry-after"]).toBeDefined();
    const parsed = errorResponseSchema.parse(third.body);
    expect(parsed.error.code).toBe("RATE_LIMITED");
  });
});
