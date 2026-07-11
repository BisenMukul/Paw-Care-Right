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
 * Metadata key read by `HouseholdScopeGuard`'s additive "resolve from
 * membership" mode. Set (via `@HouseholdFromMembership()`) on flat routes
 * that carry no household id in the URL at all (e.g. `/pets`) — the guard
 * instead resolves the caller's sole `Membership` and injects
 * `req.householdScope` from it. Independent of `HOUSEHOLD_SCOPE_PARAM_KEY`;
 * a route should use one mode or the other, never both.
 */
export const HOUSEHOLD_SCOPE_FROM_MEMBERSHIP_KEY = "householdScopeFromMembership";

/**
 * Marks a handler (or an entire controller class) as household-scoped via
 * the caller's own membership rather than a route param. v1 assumes exactly
 * one household per user (auto-provisioned): zero or more than one
 * membership both resolve to `NotFoundException` (see `HouseholdScopeGuard`
 * and plan Risk R2 — multi-household selection is deferred to T027/T028).
 */
export const HouseholdFromMembership = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(HOUSEHOLD_SCOPE_FROM_MEMBERSHIP_KEY, true);

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
