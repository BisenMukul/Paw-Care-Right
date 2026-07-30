import { Injectable } from "@nestjs/common";
import type { AppConfigResponse } from "@bombaypetcompany/types";

import { AppConfigService } from "../config/app-config.service";
import { FeatureFlagsService } from "./feature-flags.service";
import { assignPaywallVariant } from "./variant-assignment";

/**
 * Backs `GET /v1/config` (T074 plan decision 4; grown by T079 plan decision
 * 6; grown by T106 for feature kill switches). Server-sent fields: the
 * paywall A/B variant (env override OR a stable per-user hash, T079 plan
 * decision 1), the min-supported-client-version gate, the bundled
 * hotline-pack version tag, and the `features` kill-switch flags (T106
 * D2/D7 -- Redis-overridable, env-defaulted). No DB -- everything comes
 * from the validated env (`AppConfigService`) plus the caller's optional
 * userId (set by `OptionalJwtAuthGuard` on the controller).
 */
@Injectable()
export class RemoteConfigService {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async getConfig(userId?: string): Promise<AppConfigResponse> {
    return {
      paywall: { variant: assignPaywallVariant(userId, this.appConfig.paywallVariant) },
      minSupportedVersion: this.appConfig.minSupportedVersion,
      hotlinePackVersion: this.appConfig.hotlinePackVersion,
      features: await this.featureFlags.getAll(),
    };
  }
}
