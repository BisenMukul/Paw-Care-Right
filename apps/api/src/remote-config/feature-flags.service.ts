import { Injectable, Logger } from "@nestjs/common";
import type { FeatureFlags, FeatureKey } from "@bombaypetcompany/types";

import { AppConfigService } from "../config/app-config.service";
import { RedisService } from "../redis/redis.service";

/**
 * T106 plan decisions D2/D3/D4 — a launch-safe "kill switch" for `checks`
 * and `chat` (and a plumbed-only `paywall` flag, D7) that needs NO deploy or
 * restart to flip.
 *
 * D2 — resolution order per flag: Redis key `bombaypetcompany:flags:<key>`
 * → `"off"` disables, `"on"` enables, anything else (missing key, unknown
 * value) falls back to the env default (`FEATURE_CHECKS`/`FEATURE_CHAT`/
 * `FEATURE_PAYWALL`, `AppConfigService`).
 *
 * D3 — the operator mechanism is a documented `redis-cli` command, NOT a
 * new admin endpoint (see `docs/release-runbook.md` §14):
 *   Kill:    redis-cli -u "$REDIS_URL" SET bombaypetcompany:flags:checks off
 *   Restore: redis-cli -u "$REDIS_URL" DEL bombaypetcompany:flags:checks
 * No TTL is ever set on the key — an expiring kill switch would silently
 * re-enable a feature mid-incident.
 *
 * D4 — each resolved value is cached in-process for `FLAG_CACHE_TTL_MS` so
 * the hot check/chat path does not round-trip Redis per request. On a Redis
 * read error: return the last value THIS PROCESS successfully read (sticky
 * last-known), else the env default. A Redis blip must never silently
 * revert an already-observed kill.
 */
export const FLAG_REDIS_KEY_PREFIX = "bombaypetcompany:flags:";
export const FLAG_CACHE_TTL_MS = 5_000;

interface CacheEntry {
  value: boolean;
  readAt: number;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly cache = new Map<FeatureKey, CacheEntry>();

  constructor(
    private readonly redis: RedisService,
    private readonly appConfig: AppConfigService,
  ) {}

  async isEnabled(key: FeatureKey): Promise<boolean> {
    const cached = this.cache.get(key);
    const now = Date.now();
    if (cached && now - cached.readAt < FLAG_CACHE_TTL_MS) {
      return cached.value;
    }

    const envDefault = this.envDefault(key);

    try {
      const raw = await this.redis.get(`${FLAG_REDIS_KEY_PREFIX}${key}`);
      const value = raw === "off" ? false : raw === "on" ? true : envDefault;
      this.cache.set(key, { value, readAt: now });
      return value;
    } catch (error) {
      this.logger.warn(
        `Redis read failed while resolving feature flag "${key}"; falling back to ${
          cached ? "last known value" : "env default"
        }.`,
        error instanceof Error ? error.stack : undefined,
      );
      // D4: sticky last-known value on a Redis error, else the env default.
      return cached ? cached.value : envDefault;
    }
  }

  async getAll(): Promise<FeatureFlags> {
    const [checks, chat, paywall] = await Promise.all([
      this.isEnabled("checks"),
      this.isEnabled("chat"),
      this.isEnabled("paywall"),
    ]);
    return { checks, chat, paywall };
  }

  private envDefault(key: FeatureKey): boolean {
    switch (key) {
      case "checks":
        return this.appConfig.featureChecksDefault;
      case "chat":
        return this.appConfig.featureChatDefault;
      case "paywall":
        return this.appConfig.featurePaywallDefault;
    }
  }
}
