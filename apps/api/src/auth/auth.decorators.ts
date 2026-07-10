import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";

import type { RequestWithUser } from "../common/authenticated-request";

/**
 * Metadata key read by `JwtAuthGuard`. Present (via `@Public()`) means the
 * route is exempt from the access-JWT requirement.
 */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marks a handler (or an entire controller class) as not requiring an
 * access token. `JwtAuthGuard` checks both the handler and the class via
 * `Reflector.getAllAndOverride`.
 */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Param decorator exposing the authenticated user attached by
 * `JwtAuthGuard`. Only meaningful on non-`@Public()` routes, where the
 * guard guarantees `req.user` is set before the handler runs.
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.user;
});
