import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { appConfigResponseSchema } from "@pawcareright/types";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { mintAccessToken, overrideCheckRunner, resolveJwtService } from "./factories";

/**
 * `GET /v1/config` (T074 plan; grown by T079 plan). Asserts the route is
 * reachable WITHOUT an `Authorization` header (i.e. `@Public()` is actually
 * wired through the global `JwtAuthGuard`), that the body matches the
 * shared `appConfigResponseSchema` exactly (default env -> `PAYWALL_VARIANT`
 * `AUTO` + no user -> variant `"A"`), that an AUTHED call (valid Bearer
 * token) still returns a schema-valid body with a variant present (proving
 * `OptionalJwtAuthGuard` reads the user), and that a garbage/invalid token
 * still returns 200 (fail-open, never a 401 -- T079 plan Risk 5).
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
    expect(parsed).toEqual({
      paywall: { variant: "A" },
      minSupportedVersion: "0.0.0",
      hotlinePackVersion: 1,
    });
  });

  it("GET /v1/config with a valid Bearer token returns 200 with a schema-valid body and a variant present", async () => {
    const jwt = resolveJwtService(app);
    const token = mintAccessToken(jwt, "e2e-config-user");

    const res = await request(app.getHttpServer()).get("/v1/config").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const parsed = appConfigResponseSchema.parse(res.body);
    expect(["A", "B"]).toContain(parsed.paywall.variant);
  });

  it("GET /v1/config with a garbage/invalid Bearer token still returns 200 (fails open, not 401)", async () => {
    const res = await request(app.getHttpServer())
      .get("/v1/config")
      .set("Authorization", "Bearer this-is-not-a-real-jwt");

    expect(res.status).toBe(200);
    const parsed = appConfigResponseSchema.parse(res.body);
    expect(parsed.paywall.variant).toBe("A");
  });
});
