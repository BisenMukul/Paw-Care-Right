import { z } from "zod";

export const apiEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default(
      "postgresql://bombaypetcompany:bombaypetcompany@localhost:5432/bombaypetcompany?schema=public",
    ),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SECRET: z.string().min(1).default("dev-insecure-jwt-secret-do-not-use-in-production"),
  OTP_HMAC_SECRET: z.string().min(1).default("dev-insecure-otp-hmac-secret-do-not-use-in-production"),
  APPLE_CLIENT_ID: z.string().min(1).default("com.bombaypetcompany.app"),
  GOOGLE_CLIENT_ID: z.string().min(1).default("bombaypetcompany-dev.apps.googleusercontent.com"),
  WEB_ADMIN_ORIGIN: z.string().url().default("http://localhost:3001"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1).default("bombaypetcompany"),
  S3_SECRET_KEY: z.string().min(1).default("bombaypetcompany-dev-secret"),
  S3_BUCKET: z.string().min(1).default("bombaypetcompany-media"),
  RC_WEBHOOK_AUTH_TOKEN: z
    .string()
    .min(1)
    .default("dev-insecure-rc-webhook-token-do-not-use-in-production"),
  PAYWALL_VARIANT: z.enum(["A", "B", "AUTO"]).default("AUTO"),
  MIN_SUPPORTED_VERSION: z.string().default("0.0.0"),
  HOTLINE_PACK_VERSION: z.coerce.number().int().nonnegative().default(1),
  // T114: empty string = no critical OTA update; a real value is the EAS
  // `updateId` published with the `[critical]` marker (docs/OTA_UPDATES.md §3).
  CRITICAL_OTA_VERSION: z.string().default(""),
  // --- Forced/recommended binary upgrade gate (T115). "0.0.0" = no gate on
  // that platform (NO_GATE_VERSION, packages/types/src/config.ts). Raise
  // MIN_APP_VERSION_* only after a binary carrying at least that version is
  // live in the corresponding store (see the T115 plan's founder delta). ---
  MIN_APP_VERSION_IOS: z.string().default("0.0.0"),
  MIN_APP_VERSION_ANDROID: z.string().default("0.0.0"),
  RECOMMENDED_APP_VERSION_IOS: z.string().default("0.0.0"),
  RECOMMENDED_APP_VERSION_ANDROID: z.string().default("0.0.0"),
  // --- Feature kill switches (T106). z.coerce.boolean() is deliberately
  // avoided here: it would coerce the string "false" to `true`. ---
  FEATURE_CHECKS: z.enum(["on", "off"]).default("on"),
  FEATURE_CHAT: z.enum(["on", "off"]).default("on"),
  FEATURE_PAYWALL: z.enum(["on", "off"]).default("on"),
  POSTHOG_API_KEY: z.string().default(""),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
  // --- Observability (T089). Stub-safe: empty DSN never inits Sentry. ---
  SENTRY_DSN: z.string().default(""),
  SENTRY_ENVIRONMENT: z.string().optional(),
  GIT_SHA: z.string().min(1).default("dev"),
  APP_VERSION: z.string().min(1).default("0.0.0"),
  // T117: shared-secret admin guard for `/v1/meta/client-versions`. Empty
  // (the default) means the endpoint refuses every caller — it is never
  // exposed by an unconfigured deployment (D6 fail-closed).
  ADMIN_API_TOKEN: z.string().default(""),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
