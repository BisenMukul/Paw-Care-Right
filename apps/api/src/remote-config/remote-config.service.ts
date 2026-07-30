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
 *
 * T114: also mirrors `criticalOtaVersion` -- the EAS `updateId` that MUST
 * be running, `null` = no critical update. Belt-and-braces signal for
 * clients that fetched before the `[critical]` publish-message marker
 * (docs/OTA_UPDATES.md §3).
 *
 * T115: also mirrors the per-platform `minAppVersion`/`recommendedAppVersion`
 * gates (env-defaulted, "0.0.0" = no gate) that drive the mobile client's
 * blocking upgrade screen / dismissible recommended-update banner.
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
      criticalOtaVersion: this.appConfig.criticalOtaVersion,
      minAppVersion: this.appConfig.minAppVersion,
      recommendedAppVersion: this.appConfig.recommendedAppVersion,
    };
  }
}
