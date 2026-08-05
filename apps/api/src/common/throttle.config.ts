import type { ThrottlerOptions } from "@nestjs/throttler";

// Global default throttler: 100 requests / 60 s per IP, registered as the
// single named `default` throttler in `ThrottlerModule.forRoot` (see
// app.module.ts). Existing e2e suites' worst case (~30 same-IP requests in
// auth.e2e-spec.ts) stays well under this ceiling.
//
// DoS floor for every route not given its own class below (all reads, all
// non-AI writes). Reads are cheap; tightening them would break legitimate
// list/poll traffic.
export const THROTTLE_DEFAULT: Pick<ThrottlerOptions, "ttl" | "limit"> = {
  ttl: 60_000,
  limit: 100,
};

// Strictest class: credential-guessing + OTP-enumeration surface
// (`POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/social`).
// Matches the value already documented in `auth.controller.ts`'s Swagger
// copy and the existing `OtpRateLimitGuard`.
export const THROTTLE_AUTH = { default: { limit: 5, ttl: 60_000 } };

// Token rotation (`POST /auth/refresh`, `POST /auth/logout`) is legitimate
// and bursty (cold start + concurrent 401 retries). `THROTTLE_AUTH`'s 5/min
// would spuriously log users out; 30/min is still 3.3x tighter than
// `THROTTLE_DEFAULT`.
export const THROTTLE_AUTH_REFRESH = { default: { limit: 30, ttl: 60_000 } };

// AI-triggering and cost-bearing chat routes (`POST /chat/threads`,
// `POST /chat/threads/:id/messages`). 20/min is far above any human typing
// rate and far below scripted abuse. NOT a §5 escalation surface (see
// `checks.controller.ts`).
export const THROTTLE_AI_WRITE = { default: { limit: 20, ttl: 60_000 } };

// `THROTTLE_CHECKS` (10/day) has been REMOVED (T090 plan Step 2 -- was a
// dead export, zero usages). The symptom-check routes
// (`POST /pets/:petId/checks`, `POST /checks/:id/followup`,
// `GET /checks/:id`) are deliberately `@SkipThrottle()`d in
// `checks.controller.ts`; the per-user check ceiling is `QuotaService`
// (which exempts red-flag checks, `checks.service.ts` step 5) plus the
// alert-only `AnomalyService` counter (`abuse/`). A throttler class here
// would 429 a red-flag check before the deterministic rules ever run,
// making the Emergency interstitial unreachable (PRODUCT_SPEC §5 rule 3).
// Removing the constant removes a loaded gun -- do not re-add a numeric
// class for these routes.

// Left as-is for the future F3 food-safety endpoint task -- no food route
// exists in the API yet. Do not delete, do not apply.
export const THROTTLE_FOOD = { default: { limit: 60, ttl: 60_000 } };

// T090 plan Step 5 finding: `GET /config` (`remote-config.controller.ts`)
// is NOT exempted. Verified: `RemoteConfigService.getConfig` only ever
// returns the paywall variant, `minSupportedVersion`, and a
// `hotlinePackVersion` NUMBER (a staleness tag) -- never the hotline phone
// numbers themselves, which are bundled client-side in `@bombaypetcompany/data`
// (`apps/mobile/src/config/hotline-pack.ts` only compares that number
// against `BUNDLED_HOTLINE_PACK_VERSION`; it never fetches or renders
// numbers from the network). The app can render emergency hotlines with
// zero network calls, so `/config` stays on `THROTTLE_DEFAULT`.
