import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";

import type { RequestWithHouseholdScope } from "./authenticated-request";
import { REQUIRED_ROLE_KEY } from "./household-scope.decorators";

/**
 * Global role-enforcement guard (registered as `APP_GUARD`, third/last in
 * the chain, after `HouseholdScopeGuard`). A no-op on routes without
 * `@RequireRole()`. On guarded routes, requires an exact match between the
 * caller's resolved household role and the required role. A missing
 * `req.householdScope` (e.g. `@RequireRole()` used without
 * `@HouseholdScoped()`, or a mis-ordered guard chain) fails closed with a
 * 403 rather than granting access — it can never produce a false "allow".
 * Within a household the caller already knows the resource exists, so an
 * insufficient role is a legitimate 403, not a 404.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role | undefined>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithHouseholdScope>();
    const scope = request.householdScope;

    if (!scope) {
      throw new ForbiddenException();
    }

    if (scope.role !== required) {
      throw new ForbiddenException();
    }

    return true;
  }
}
