import { Controller, Delete, Get } from "@nestjs/common";

import { CurrentUser } from "../src/auth/auth.decorators";
import type { HouseholdScope } from "../src/common/authenticated-request";
import { CurrentHousehold, HouseholdScoped, RequireRole } from "../src/common/household-scope.decorators";

// Test-only controller. Never imported by AppModule and excluded from
// tsconfig.build.json (so it never ships in production dist) — mirrors
// `test-throw.controller.ts`. It is injected directly into the Nest
// testing module by `guards.e2e-spec.ts` to exercise the real global
// APP_GUARD chain (JwtAuthGuard → HouseholdScopeGuard → RolesGuard)
// against a household-scoped route. Deliberately NOT `@Public()`.
@Controller("__test__/households")
export class HouseholdScopedTestController {
  @Get(":householdId/resource")
  @HouseholdScoped("householdId")
  getResource(
    @CurrentHousehold() scope: HouseholdScope,
    @CurrentUser() user: { userId: string },
  ): { scope: HouseholdScope; userId: string } {
    return { scope, userId: user.userId };
  }

  @Delete(":householdId/resource")
  @HouseholdScoped("householdId")
  @RequireRole("OWNER")
  deleteResource(): { ok: true } {
    return { ok: true };
  }
}
