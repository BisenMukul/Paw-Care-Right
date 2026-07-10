import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { AppConfigService } from "./config/app-config.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get(AppConfigService);
  const port = config.port;

  await app.listen(port);
  Logger.log(`${APP_DISPLAY_NAME} API listening on port ${port}`, "Bootstrap");
}

void bootstrap();
