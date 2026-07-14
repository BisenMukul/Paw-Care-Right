import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { NotificationPrefsController } from "./notification-prefs.controller";
import { NotificationPrefsService } from "./notification-prefs.service";

@Module({
  imports: [PrismaModule],
  controllers: [NotificationPrefsController],
  providers: [NotificationPrefsService],
})
export class NotificationPrefsModule {}
