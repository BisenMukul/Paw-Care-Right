import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { errorResponseSchema } from "@pawcareright/types";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { REQUEST_ID_HEADER } from "../src/common/request-id.middleware";
import { TestThrowController } from "./test-throw.controller";

describe("AppModule (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestThrowController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /v1/health returns 200 with db+redis ok", async () => {
    const res = await request(app.getHttpServer()).get("/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "ok", redis: "ok" });
  });

  it("GET /v1/__test__/boom returns a NOT_FOUND error envelope with matching requestId", async () => {
    const res = await request(app.getHttpServer()).get("/v1/__test__/boom");

    expect(res.status).toBe(404);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("NOT_FOUND");
    expect(typeof parsed.error.requestId).toBe("string");
    expect(parsed.error.requestId.length).toBeGreaterThan(0);
    expect(res.headers[REQUEST_ID_HEADER]).toBe(parsed.error.requestId);
  });

  it("POST /v1/__test__/echo with an invalid body returns a VALIDATION_FAILED error envelope", async () => {
    const res = await request(app.getHttpServer()).post("/v1/__test__/echo").send({});

    expect(res.status).toBe(400);
    const parsed = errorResponseSchema.parse(res.body);
    expect(parsed.error.code).toBe("VALIDATION_FAILED");
  });

  it("GET /docs-json serves an OpenAPI document", async () => {
    const res = await request(app.getHttpServer()).get("/docs-json");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("openapi");
    expect(res.body).toHaveProperty("info");
  });

  it("GET /docs serves the Swagger HTML UI", async () => {
    const res = await request(app.getHttpServer()).get("/docs");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });
});
