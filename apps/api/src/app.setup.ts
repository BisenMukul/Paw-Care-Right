import type { INestApplication } from "@nestjs/common";
import { PayloadTooLargeException, ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { APP_DISPLAY_NAME } from "@pawcareright/config";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { requestIdMiddleware } from "./common/request-id.middleware";
import { AppConfigService } from "./config/app-config.service";

// body-parser (used internally by `useBodyParser`) raises its over-limit
// error as a plain Node error, not a Nest `HttpException` — `resolve()` in
// `AllExceptionsFilter` (untouched by this task) would otherwise map it to
// a generic 500 INTERNAL. This middleware re-normalizes that one error type
// into `PayloadTooLargeException` so the true 413 status is what the filter
// reports; the response body still uses the standard error envelope.
function isPayloadTooLargeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "entity.too.large"
  );
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(`${APP_DISPLAY_NAME} API`)
    .setDescription(`Backend API for the ${APP_DISPLAY_NAME} pet care companion app.`)
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);
}

// Shared by main.ts and the e2e test so production and test behave identically.
export function configureApp(app: INestApplication): void {
  app.use(requestIdMiddleware);
  // CSP is disabled: it would break the served Swagger UI (/docs). All other
  // helmet defaults (nosniff, frame-options, dns-prefetch-control, HSTS,
  // x-powered-by removal) stay on — the standard choice for a token-auth
  // JSON API with no browser-rendered content of our own.
  app.use(helmet({ contentSecurityPolicy: false }));

  const config = app.get(AppConfigService);
  // Bearer-token auth, no cookies — mobile is native and sends no Origin.
  app.enableCors({ origin: [config.webAdminOrigin], credentials: false });

  const expressApp = app as NestExpressApplication;
  expressApp.useBodyParser("json", { limit: "1mb" });
  expressApp.useBodyParser("urlencoded", { limit: "1mb", extended: true });
  expressApp.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    next(isPayloadTooLargeError(error) ? new PayloadTooLargeException() : error);
  });

  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  setupSwagger(app);
}
