import { Module } from "@nestjs/common";

import { BillingModule } from "../billing/billing.module";
import { ConfigModule } from "../config/config.module";
import { AdminTokenGuard } from "../meta/admin-token.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminAuditService } from "./admin-audit.service";
import { AdminController } from "./admin.controller";
import { AdminKpisService } from "./admin-kpis.service";
import { AdminUsersService } from "./admin-users.service";

/**
 * T111: hosts the read-only `/v1/admin/*` mini-dashboard. Reuses the T117
 * `AdminTokenGuard` (declared in `meta/`, not duplicated here) and
 * `BillingModule`'s exported `BillingService` for the user-lookup
 * entitlement field (D4).
 */
@Module({
  imports: [PrismaModule, ConfigModule, BillingModule],
  controllers: [AdminController],
  providers: [AdminKpisService, AdminUsersService, AdminAuditService, AdminTokenGuard],
})
export class AdminModule {}
