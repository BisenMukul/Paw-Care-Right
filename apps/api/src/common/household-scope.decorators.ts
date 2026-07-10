import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Role } from "@prisma/client";

import type { RequestWithHouseholdScope } from "./authenticated-request";

/**
 * Metadata key read by `HouseholdScopeGuard`. Its value is the name of the
 * route param holding the household id to resolve membership against.
 * Absent on a route → the guard no-ops (not every route is household
 * scoped).
 */
export const HOUSEHOLD_SCOPE_PARAM_KEY = "householdScopeParam";

/**
 * Marks a handler as household-scoped: `HouseholdScopeGuard` resolves the
 * caller's `Membership` for `req.params[paramName]` and injects
 * `req.householdScope`, or throws `NotFoundException` if no membership
 * exists (never a 403 — cross-household access must not leak existence).
 */
export const HouseholdScoped = (paramName = "householdId"): ReturnType<typeof SetMetadata> =>
  SetMetadata(HOUSEHOLD_SCOPE_PARAM_KEY, paramName);

/**
 * Metadata key read by `RolesGuard`. Its value is the `Role` required to
 * proceed. Absent on a route → the guard no-ops.
 */
export const REQUIRED_ROLE_KEY = "requiredRole";

/**
 * Requires the caller's role in the resolved household scope to match
 * `role` exactly. Must be paired with `@HouseholdScoped()` on the same
 * route — `RolesGuard` fail-closes (403) if no scope was resolved.
 */
export const RequireRole = (role: Role): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_ROLE_KEY, role);

/**
 * Param decorator exposing the household scope attached by
 * `HouseholdScopeGuard`. Only meaningful on `@HouseholdScoped()` routes.
 */
export const CurrentHousehold = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithHouseholdScope>();
  return request.householdScope;
});
