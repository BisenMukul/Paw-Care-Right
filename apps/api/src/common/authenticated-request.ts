import type { Role } from "@prisma/client";
import type { Request } from "express";

/**
 * Request shape after `JwtAuthGuard` has run. `user` is undefined until the
 * guard populates it — always present by the time a non-`@Public()` handler
 * executes, absent on `@Public()` routes that never verify a token.
 */
export interface RequestWithUser extends Request {
  user?: { userId: string };
}

/**
 * The resolved household membership for the current request, injected by
 * `HouseholdScopeGuard` on routes carrying `@HouseholdScoped()`.
 */
export interface HouseholdScope {
  householdId: string;
  role: Role;
}

/** Request shape after `HouseholdScopeGuard` has run on a scoped route. */
export interface RequestWithHouseholdScope extends RequestWithUser {
  householdScope?: HouseholdScope;
}
