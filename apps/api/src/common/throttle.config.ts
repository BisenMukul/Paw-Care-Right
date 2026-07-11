import type { ThrottlerOptions } from "@nestjs/throttler";

// Global default throttler: 100 requests / 60 s per IP, registered as the
// single named `default` throttler in `ThrottlerModule.forRoot` (see
// app.module.ts). Existing e2e suites' worst case (~30 same-IP requests in
// auth.e2e-spec.ts) stays well under this ceiling.
export const THROTTLE_DEFAULT: Pick<ThrottlerOptions, "ttl" | "limit"> = {
  ttl: 60_000,
  limit: 100,
};

// Per-route override configs for FUTURE `@Throttle(...)` decorators. These
// are deliberately NOT registered as named throttlers in `forRoot` — in
// @nestjs/throttler v6 every named throttler applies to every route unless
// `@SkipThrottle`d, so a global `auth` (5/min) throttler would throttle ALL
// routes at 5/min and collapse every suite. `checks`/`food` routes don't
// exist yet; these configs are defined only, for the tasks that add them.
export const THROTTLE_AUTH = { default: { limit: 5, ttl: 60_000 } };
export const THROTTLE_CHECKS = { default: { limit: 10, ttl: 86_400_000 } };
export const THROTTLE_FOOD = { default: { limit: 60, ttl: 60_000 } };
