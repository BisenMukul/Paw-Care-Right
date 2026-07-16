import { Injectable } from "@nestjs/common";
import { defineEnv } from "@pawcareright/config/env";

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

  get posthogApiKey(): string {
    return this.env.POSTHOG_API_KEY;
  }

  get posthogHost(): string {
    return this.env.POSTHOG_HOST;
  }
}
