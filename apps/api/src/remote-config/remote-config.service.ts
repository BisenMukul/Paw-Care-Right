import { Injectable } from "@nestjs/common";
import type { AppConfigResponse } from "@pawcareright/types";

import { AppConfigService } from "../config/app-config.service";

/**
 * Backs `GET /v1/config` (T074 plan decision 4). The ONLY server-sent field
 * is the paywall A/B variant, sourced from the validated
 * `PAYWALL_VARIANT` env var (default `"A"`) so ops can flip the variant
 * without a client deploy. No DB, no auth, no arbitrary copy — all paywall
 * prose stays client-side (plan decision 5).
 */
@Injectable()
export class RemoteConfigService {
  constructor(private readonly appConfig: AppConfigService) {}

  getConfig(): AppConfigResponse {
    return { paywall: { variant: this.appConfig.paywallVariant } };
  }
}
