import { Injectable } from "@nestjs/common";
import { defineEnv } from "@bombaypetcompany/config/env";

import { apiEnvSchema, type ApiEnv } from "./env.schema";

@Injectable()
export class AppConfigService {
  private readonly env: ApiEnv;

  constructor() {
    this.env = defineEnv(apiEnvSchema);
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get redisUrl(): string {
    return this.env.REDIS_URL;
  }

  get port(): number {
    return this.env.PORT;
  }

  get nodeEnv(): ApiEnv["NODE_ENV"] {
    return this.env.NODE_ENV;
  }

  get jwtSecret(): string {
    return this.env.JWT_SECRET;
  }

  get otpHmacSecret(): string {
    return this.env.OTP_HMAC_SECRET;
  }

  get appleClientId(): string {
    return this.env.APPLE_CLIENT_ID;
  }

  get googleClientId(): string {
    return this.env.GOOGLE_CLIENT_ID;
  }

  get webAdminOrigin(): string {
    return this.env.WEB_ADMIN_ORIGIN;
  }

  get s3Endpoint(): string {
    return this.env.S3_ENDPOINT;
  }

  get s3Region(): string {
    return this.env.S3_REGION;
  }

  get s3AccessKey(): string {
    return this.env.S3_ACCESS_KEY;
  }

  get s3SecretKey(): string {
    return this.env.S3_SECRET_KEY;
  }

  get s3Bucket(): string {
    return this.env.S3_BUCKET;
  }

  get rcWebhookAuthToken(): string {
    return this.env.RC_WEBHOOK_AUTH_TOKEN;
  }

  get paywallVariant(): ApiEnv["PAYWALL_VARIANT"] {
    return this.env.PAYWALL_VARIANT;
  }

  get minSupportedVersion(): string {
    return this.env.MIN_SUPPORTED_VERSION;
  }

  get hotlinePackVersion(): number {
    return this.env.HOTLINE_PACK_VERSION;
  }

  /** T114: empty env value normalises to `null` ("no critical update"). */
  get criticalOtaVersion(): string | null {
    return this.env.CRITICAL_OTA_VERSION === "" ? null : this.env.CRITICAL_OTA_VERSION;
  }

  /** T106: env default for the `checks` kill switch — the Redis override in
   * `FeatureFlagsService` takes precedence when present. */
  get featureChecksDefault(): boolean {
    return this.env.FEATURE_CHECKS === "on";
  }

  /** T106: env default for the `chat` kill switch. */
  get featureChatDefault(): boolean {
    return this.env.FEATURE_CHAT === "on";
  }

  /** T106: env default for the `paywall` flag (plumbed, not enforced — D7). */
  get featurePaywallDefault(): boolean {
    return this.env.FEATURE_PAYWALL === "on";
  }

  get posthogApiKey(): string {
    return this.env.POSTHOG_API_KEY;
  }

  get posthogHost(): string {
    return this.env.POSTHOG_HOST;
  }

  get sentryDsn(): string {
    return this.env.SENTRY_DSN;
  }

  get sentryEnvironment(): string {
    return this.env.SENTRY_ENVIRONMENT ?? this.nodeEnv;
  }

  get gitSha(): string {
    return this.env.GIT_SHA;
  }

  get appVersion(): string {
    return this.env.APP_VERSION;
  }
}
