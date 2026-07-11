import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PrismaService } from "../prisma/prisma.service";
import type { RequestWithHouseholdScope } from "./authenticated-request";
import {
  HOUSEHOLD_SCOPE_FROM_MEMBERSHIP_KEY,
  HOUSEHOLD_SCOPE_PARAM_KEY,
} from "./household-scope.decorators";

/**
 * Global household-membership guard (registered as `APP_GUARD`, second in
 * the chain, after `JwtAuthGuard`). A no-op on routes without
 * `@HouseholdScoped()` or `@HouseholdFromMembership()`. On scoped routes,
 * resolves the caller's `Membership` — either for the household id named by
 * the param-mode metadata, or (from-membership mode) by looking up the
 * caller's own memberships — and injects `req.householdScope`. No
 * membership → `NotFoundException` (404), never a 403 — a cross-household
 * caller must not be able to distinguish "exists but you're not a member"
 * from "does not exist".
 */
@Injectable()
export class HouseholdScopeGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(HOUSEHOLD_SCOPE_PARAM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (paramName !== undefined) {
      return this.resolveFromParam(context, paramName);
    }

    const fromMembership = this.reflector.getAllAndOverride<boolean | undefined>(
      HOUSEHOLD_SCOPE_FROM_MEMBERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!fromMembership) {
      return true;
    }

    return this.resolveFromMembership(context);
  }

  private async resolveFromParam(context: ExecutionContext, paramName: string): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHouseholdScope>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException();
    }

    // Express types route params as string | string[]; a repeated param
    // (array) is malformed input for a scoped id — treat as not found.
    const rawParam: string | string[] | undefined = request.params[paramName];
    const householdId = typeof rawParam === "string" ? rawParam : undefined;

    if (!householdId) {
      throw new NotFoundException();
    }

    const membership = await this.prisma.membership.findUnique({
      where: { userId_householdId: { userId, householdId } },
    });

    if (!membership) {
      throw new NotFoundException();
    }

    request.householdScope = { householdId, role: membership.role };

    return true;
  }

  /**
   * v1 assumes exactly one household per user (auto-provisioned at
   * signup). Zero memberships → `NotFoundException` (nothing to resolve).
   * More than one → also `NotFoundException`: fails safe rather than
   * guessing which household the caller meant. See plan Risk R2 — a
   * selector lands with multi-household support (T027/T028).
   */
  private async resolveFromMembership(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithHouseholdScope>();
    const userId = request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException();
    }

    const memberships = await this.prisma.membership.findMany({ where: { userId } });
    const membership = memberships.length === 1 ? memberships[0] : undefined;

    if (!membership) {
      throw new NotFoundException();
    }

    request.householdScope = { householdId: membership.householdId, role: membership.role };

    return true;
  }
}
