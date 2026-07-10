import { Injectable, Logger } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";

/**
 * Abstraction over "send this OTP code to this email". T012 only ships a
 * dev transport that logs the code (no SMTP/email provider dependency); a
 * later task can bind a real provider behind the same `OTP_TRANSPORT`
 * token without touching callers.
 */
export interface OtpTransport {
  sendOtp(email: string, code: string): Promise<void> | void;
}

export const OTP_TRANSPORT = Symbol("OTP_TRANSPORT");

@Injectable()
export class DevLogOtpTransport implements OtpTransport {
  private readonly logger = new Logger(DevLogOtpTransport.name);

  constructor(private readonly config: AppConfigService) {}

  sendOtp(email: string, code: string): void {
    if (this.config.nodeEnv !== "production") {
      this.logger.log(`OTP for ${email}: ${code}`);
      return;
    }

    // Never log email+code together in production — this transport is
    // dev-only; a real provider must be bound before shipping to prod.
    this.logger.warn("OTP transport not configured for production");
  }
}
