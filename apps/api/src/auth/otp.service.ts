import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { RedisService } from "../redis/redis.service";
import { OTP_CODE_LENGTH, OTP_KEY_PREFIX, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS } from "./auth.constants";

interface OtpRecord {
  codeHash: string;
  attempts: number;
}

/**
 * OTP code lifecycle against Redis. Codes are never stored in plaintext —
 * only an HMAC-SHA256(code, OTP_HMAC_SECRET) digest is persisted, alongside
 * an attempt counter, under a TTL-bound, single-use key.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async generateAndStore(email: string): Promise<string> {
    const code = this.generateCode();
    const record: OtpRecord = { codeHash: this.hash(code), attempts: 0 };

    await this.redis.set(this.keyFor(email), JSON.stringify(record), OTP_TTL_SECONDS);

    return code;
  }

  async verifyCode(email: string, code: string): Promise<boolean> {
    const key = this.keyFor(email);
    const raw = await this.redis.get(key);

    if (raw === null) {
      return false;
    }

    const record = JSON.parse(raw) as OtpRecord;

    if (this.matches(code, record.codeHash)) {
      await this.redis.del(key);
      return true;
    }

    const attempts = record.attempts + 1;

    if (attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      return false;
    }

    const updated: OtpRecord = { codeHash: record.codeHash, attempts };
    await this.redis.set(key, JSON.stringify(updated), OTP_TTL_SECONDS);

    return false;
  }

  private generateCode(): string {
    const n = randomInt(0, 1_000_000);
    return String(n).padStart(OTP_CODE_LENGTH, "0");
  }

  private matches(code: string, codeHash: string): boolean {
    const candidate = Buffer.from(this.hash(code), "hex");
    const stored = Buffer.from(codeHash, "hex");

    if (candidate.length !== stored.length) {
      return false;
    }

    return timingSafeEqual(candidate, stored);
  }

  private hash(value: string): string {
    return createHmac("sha256", this.config.otpHmacSecret).update(value).digest("hex");
  }

  private keyFor(email: string): string {
    const normalized = email.trim().toLowerCase();
    return `${OTP_KEY_PREFIX}${this.hash(normalized)}`;
  }
}
