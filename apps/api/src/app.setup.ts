import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { requestIdMiddleware } from "./common/request-id.middleware";

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
  app.setGlobalPrefix("v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  setupSwagger(app);
}
