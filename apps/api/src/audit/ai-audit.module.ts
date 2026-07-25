import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { AiAuditService } from "./ai-audit.service";

@Module({
  imports: [PrismaModule],
  providers: [AiAuditService],
  exports: [AiAuditService],
})
export class AiAuditModule {}
