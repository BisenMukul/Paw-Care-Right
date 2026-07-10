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
import { HOUSEHOLD_SCOPE_PARAM_KEY } from "./household-scope.decorators";

/**
 * Global household-membership guard (registered as `APP_GUARD`, second in
 * the chain, after `JwtAuthGuard`). A no-op on routes without
 * `@HouseholdScoped()`. On scoped routes, resolves the caller's
 * `Membership` for the household id named by the metadata and injects
 * `req.householdScope`. No membership → `NotFoundException` (404), never a
 * 403 — a cross-household caller must not be able to distinguish "exists
 * but you're not a member" from "does not exist".
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

    if (paramName === undefined) {
      return true;
    }

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
}
