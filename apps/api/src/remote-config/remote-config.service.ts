import { Injectable } from "@nestjs/common";
import type { AppConfigResponse } from "@pawcareright/types";

import { AppConfigService } from "../config/app-config.service";
import { assignPaywallVariant } from "./variant-assignment";

/**
 * Backs `GET /v1/config` (T074 plan decision 4; grown by T079 plan decision
 * 6). Server-sent fields: the paywall A/B variant (env override OR a stable
 * per-user hash, T079 plan decision 1), the min-supported-client-version
 * gate, and the bundled hotline-pack version tag. No DB -- everything comes
 * from the validated env (`AppConfigService`) plus the caller's optional
 * userId (set by `OptionalJwtAuthGuard` on the controller).
 */
@Injectable()
export class RemoteConfigService {
  constructor(private readonly appConfig: AppConfigService) {}

  getConfig(userId?: string): AppConfigResponse {
    return {
      paywall: { variant: assignPaywallVariant(userId, this.appConfig.paywallVariant) },
      minSupportedVersion: this.appConfig.minSupportedVersion,
      hotlinePackVersion: this.appConfig.hotlinePackVersion,
    };
  }
}
