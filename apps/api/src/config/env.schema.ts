import { z } from "zod";

export const apiEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default(
      "postgresql://pawcareright:pawcareright@localhost:5432/pawcareright?schema=public",
    ),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_SECRET: z.string().min(1).default("dev-insecure-jwt-secret-do-not-use-in-production"),
  OTP_HMAC_SECRET: z.string().min(1).default("dev-insecure-otp-hmac-secret-do-not-use-in-production"),
  APPLE_CLIENT_ID: z.string().min(1).default("com.pawcareright.app"),
  GOOGLE_CLIENT_ID: z.string().min(1).default("pawcareright-dev.apps.googleusercontent.com"),
  WEB_ADMIN_ORIGIN: z.string().url().default("http://localhost:3001"),
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1).default("pawcareright"),
  S3_SECRET_KEY: z.string().min(1).default("pawcareright-dev-secret"),
  S3_BUCKET: z.string().min(1).default("pawcareright-media"),
  RC_WEBHOOK_AUTH_TOKEN: z
    .string()
    .min(1)
    .default("dev-insecure-rc-webhook-token-do-not-use-in-production"),
  PAYWALL_VARIANT: z.enum(["A", "B"]).default("A"),
  POSTHOG_API_KEY: z.string().default(""),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
