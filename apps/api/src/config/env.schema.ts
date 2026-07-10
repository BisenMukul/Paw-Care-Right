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
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
