import type { AppConfigService } from "../config/app-config.service";
import type { RedisService } from "../redis/redis.service";
import { OTP_KEY_PREFIX, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from "./auth.constants";
import { OtpService } from "./otp.service";

describe("OtpService", () => {
  function buildService(store: Map<string, string>) {
    const redis = {
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      del: jest.fn(async (...keys: string[]) => {
        let deleted = 0;
        for (const key of keys) {
          if (store.delete(key)) {
            deleted += 1;
          }
        }
        return deleted;
      }),
    } as unknown as RedisService;

    const config = { otpHmacSecret: "test-otp-hmac-secret" } as unknown as AppConfigService;

    return { service: new OtpService(redis, config), redis };
  }

  it("generateAndStore returns a 6-digit code and stores it via redis.set with the OTP key prefix + TTL", async () => {
    const store = new Map<string, string>();
    const { service, redis } = buildService(store);

    const code = await service.generateAndStore("user@example.com");

    expect(code).toMatch(/^\d{6}$/);
    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, , ttl] = (redis.set as jest.Mock).mock.calls[0] as [string, string, number];
    expect(key.startsWith(OTP_KEY_PREFIX)).toBe(true);
    expect(ttl).toBe(OTP_TTL_SECONDS);
  });

  it("verifyCode returns true and deletes the key on a matching code", async () => {
    const store = new Map<string, string>();
    const { service, redis } = buildService(store);
    const email = "match@example.com";
    const code = await service.generateAndStore(email);

    const result = await service.verifyCode(email, code);

    expect(result).toBe(true);
    expect(redis.del).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
  });

  it("verifyCode returns false and persists an incremented attempt count on a mismatch", async () => {
    const store = new Map<string, string>();
    const { service, redis } = buildService(store);
    const email = "mismatch@example.com";
    await service.generateAndStore(email);

    const result = await service.verifyCode(email, "000000");

    expect(result).toBe(false);
    expect(redis.del).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
    const [, storedRaw] = (redis.set as jest.Mock).mock.calls[1] as [string, string, number];
    const stored = JSON.parse(storedRaw) as { attempts: number };
    expect(stored.attempts).toBe(1);
  });

  it("verifyCode returns false and deletes the key once attempts reach OTP_MAX_ATTEMPTS", async () => {
    const store = new Map<string, string>();
    const { service, redis } = buildService(store);
    const email = "capped@example.com";
    const code = await service.generateAndStore(email);
    const wrongCode = code === "000000" ? "111111" : "000000";

    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS - 1; attempt += 1) {
      const result = await service.verifyCode(email, wrongCode);
      expect(result).toBe(false);
    }
    expect(store.size).toBe(1);

    const finalResult = await service.verifyCode(email, wrongCode);

    expect(finalResult).toBe(false);
    expect(store.size).toBe(0);
    expect(redis.del).toHaveBeenCalledTimes(1);
  });

  it("verifyCode returns false when no record exists for the email", async () => {
    const store = new Map<string, string>();
    const { service } = buildService(store);

    const result = await service.verifyCode("missing@example.com", "123456");

    expect(result).toBe(false);
  });
});
