import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { appConfigResponseSchema } from "@bombaypetcompany/types";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { mintAccessToken, overrideCheckRunner, resolveJwtService } from "./factories";

/**
 * `GET /v1/config` (T074 plan; grown by T079 plan; grown by T106 for feature
 * kill switches). Asserts the route is reachable WITHOUT an `Authorization`
 * header (i.e. `@Public()` is actually wired through the global
 * `JwtAuthGuard`), that the body matches the shared `appConfigResponseSchema`
 * exactly (default env -> `PAYWALL_VARIANT` `AUTO` + no user -> variant
 * `"A"`; default `FEATURE_*` env vars all `"on"` -> `features` all `true`),
 * that an AUTHED call (valid Bearer token) still returns a schema-valid body
 * with a variant present and `features` with three booleans (proving
 * `OptionalJwtAuthGuard` reads the user), and that a garbage/invalid token
 * still returns 200 (fail-open, never a 401 -- T079 plan Risk 5).
 *
 * T114: default env -> `CRITICAL_OTA_VERSION` "" -> `criticalOtaVersion`
 * `null` in the body.
 *
 * T115: default env -> `MIN_APP_VERSION_*`/`RECOMMENDED_APP_VERSION_*` all
 * "0.0.0" -> `minAppVersion`/`recommendedAppVersion` both `{ios:"0.0.0",
 * android:"0.0.0"}` in the body (no gate). This test keeps parsing with the
 * STRICT `appConfigResponseSchema` -- the server can never ship an
 * undocumented field (docs/OTA_UPDATES.md §5.4; the tolerant parse path is
 * client-only, see `packages/types/src/config.ts`).
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
      features: { checks: true, chat: true, paywall: true },
      criticalOtaVersion: null,
      minAppVersion: { ios: "0.0.0", android: "0.0.0" },
      recommendedAppVersion: { ios: "0.0.0", android: "0.0.0" },
    });
  });

  it("GET /v1/config with the default env has no critical OTA update (T114)", async () => {
    const res = await request(app.getHttpServer()).get("/v1/config");

    expect(res.status).toBe(200);
    const parsed = appConfigResponseSchema.parse(res.body);
    expect(parsed.criticalOtaVersion).toBeNull();
  });

  it("GET /v1/config with the default env has no forced/recommended upgrade gate on either platform (T115)", async () => {
    const res = await request(app.getHttpServer()).get("/v1/config");

    expect(res.status).toBe(200);
    const parsed = appConfigResponseSchema.parse(res.body);
    expect(parsed.minAppVersion).toEqual({ ios: "0.0.0", android: "0.0.0" });
    expect(parsed.recommendedAppVersion).toEqual({ ios: "0.0.0", android: "0.0.0" });
  });

  it("GET /v1/config with a valid Bearer token returns 200 with a schema-valid body and a variant present", async () => {
    const jwt = resolveJwtService(app);
    const token = mintAccessToken(jwt, "e2e-config-user");

    const res = await request(app.getHttpServer()).get("/v1/config").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const parsed = appConfigResponseSchema.parse(res.body);
    expect(["A", "B"]).toContain(parsed.paywall.variant);
  });

  it("GET /v1/config with a valid Bearer token returns features with three booleans (T106)", async () => {
    const jwt = resolveJwtService(app);
    const token = mintAccessToken(jwt, "e2e-config-features-user");

    const res = await request(app.getHttpServer()).get("/v1/config").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const parsed = appConfigResponseSchema.parse(res.body);
    expect(parsed.features).toEqual({ checks: true, chat: true, paywall: true });
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
