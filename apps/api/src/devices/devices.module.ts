import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { DevicesController } from "./devices.controller";
import { DevicesService } from "./devices.service";
import { LastSeenMiddleware } from "./last-seen.middleware";

@Module({
  imports: [PrismaModule],
  controllers: [DevicesController],
  providers: [DevicesService, LastSeenMiddleware],
})
export class DevicesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LastSeenMiddleware).forRoutes("*");
  }
}
