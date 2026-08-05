import { Logger } from "@nestjs/common";

import * as sentry from "../observability/sentry";
import type { RedisService } from "../redis/redis.service";
import { CHECKS_PER_HOUR_ALERT_THRESHOLD } from "./abuse.constants";
import { checksPerHourKey } from "./abuse.util";
import { AnomalyService } from "./anomaly.service";

jest.mock("../observability/sentry", () => ({
  captureApiMessage: jest.fn(),
}));

function buildRedis(overrides: { incr?: jest.Mock; expire?: jest.Mock } = {}) {
  const store = new Map<string, number>();
  const incr =
    overrides.incr ??
    jest.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    });
  const expire = overrides.expire ?? jest.fn().mockResolvedValue(undefined);
  return { redis: { incr, expire } as unknown as RedisService, incr, expire };
}

describe("AnomalyService.recordCheck", () => {
  const NOW = new Date("2026-07-25T04:00:00.000Z");

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("increments the hourly counter and sets the TTL only on the first hit", async () => {
    const { redis, incr, expire } = buildRedis();
    const service = new AnomalyService(redis);

    await service.recordCheck("user-1", NOW);
    expect(incr).toHaveBeenCalledWith(checksPerHourKey("user-1", NOW));
    expect(expire).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledWith(checksPerHourKey("user-1", NOW), 7200);

    await service.recordCheck("user-1", NOW);
    expect(expire).toHaveBeenCalledTimes(1); // not called again on the 2nd hit
  });

  it("emits abuse_anomaly exactly once, at the threshold", async () => {
    const { redis } = buildRedis();
    const service = new AnomalyService(redis);
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    try {
      // 19 calls -> count reaches 19 (threshold - 1); no alert yet.
      for (let i = 0; i < CHECKS_PER_HOUR_ALERT_THRESHOLD - 1; i += 1) {
        await service.recordCheck("user-1", NOW);
      }
      expect(warnSpy).not.toHaveBeenCalled();
      expect(sentry.captureApiMessage).not.toHaveBeenCalled();

      // count === threshold (the 20th call)
      await service.recordCheck("user-1", NOW);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ event: "abuse_anomaly" }));
      expect(sentry.captureApiMessage).toHaveBeenCalledTimes(1);

      // count === threshold + 1 (the 21st call) — no further alert.
      await service.recordCheck("user-1", NOW);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(sentry.captureApiMessage).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("the alert payload carries ids/counts only (closed key list)", async () => {
    const { redis } = buildRedis({
      incr: jest.fn().mockResolvedValue(CHECKS_PER_HOUR_ALERT_THRESHOLD),
    });
    const service = new AnomalyService(redis);
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    try {
      await service.recordCheck("user-1", NOW);
      const payload = warnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(["bucket", "count", "event", "metric", "threshold", "userId"].sort());
      expect(payload.userId).toBe("user-1");
      expect(payload.count).toBe(CHECKS_PER_HOUR_ALERT_THRESHOLD);
      expect(payload.threshold).toBe(CHECKS_PER_HOUR_ALERT_THRESHOLD);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("never throws and never signals a block when Redis fails", async () => {
    const { redis } = buildRedis({ incr: jest.fn().mockRejectedValue(new Error("redis down")) });
    const service = new AnomalyService(redis);
    const warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    try {
      await expect(service.recordCheck("user-1", NOW)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.objectContaining({ event: "abuse_anomaly_failed", userId: "user-1" }));
    } finally {
      warnSpy.mockRestore();
    }
  });
});
