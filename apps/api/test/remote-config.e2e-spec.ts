import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { appConfigResponseSchema } from "@pawcareright/types";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { overrideCheckRunner } from "./factories";

/**
 * `GET /v1/config` (T074 plan): public remote-config endpoint. Asserts the
 * route is reachable WITHOUT an `Authorization` header (i.e. `@Public()` is
 * actually wired through the global `JwtAuthGuard`) and that the body
 * matches the shared `appConfigResponseSchema` exactly (default env ->
 * variant "A").
 */
describe("Remote config (e2e)", () => {
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

  it("GET /v1/config returns 200 with a schema-valid body, no Authorization header needed", async () => {
    const res = await request(app.getHttpServer()).get("/v1/config");

    expect(res.status).toBe(200);
    const parsed = appConfigResponseSchema.parse(res.body);
    expect(parsed).toEqual({ paywall: { variant: "A" } });
  });
});
