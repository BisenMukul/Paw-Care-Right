import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ErrorCode, FeatureKey } from "@bombaypetcompany/types";

import { FEATURE_FLAG_METADATA } from "./feature-flag.decorators";
import { FeatureFlagsService } from "./feature-flags.service";

/**
 * T106 D6 — enforces `@RequiresFeature(key)` (handler metadata wins over
 * class metadata, per `Reflector.getAllAndOverride`). A route without the
 * decorator is untouched (returns `true`). The rejection message is
 * deliberately §7-safe: no diagnosis/dosing language, no medical claim —
 * this is an operational "come back later", never a clinical statement.
 *
 * F1 fix: the exception body carries an explicit `code: "FEATURE_DISABLED"`
 * (not just a bare 503) so `AllExceptionsFilter` can distinguish a kill
 * switch from any OTHER 503 producer (e.g. `health.service.ts`'s dependency
 * check) instead of mapping every 503 to the same code.
 */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<FeatureKey | undefined>(FEATURE_FLAG_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (key === undefined) {
      return true;
    }

    const enabled = await this.featureFlags.isEnabled(key);
    if (!enabled) {
      const code: ErrorCode = "FEATURE_DISABLED";
      throw new ServiceUnavailableException({
        code,
        message: "This feature is temporarily unavailable.",
      });
    }

    return true;
  }
}
