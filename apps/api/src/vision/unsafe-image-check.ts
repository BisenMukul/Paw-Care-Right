import { Injectable, Logger } from "@nestjs/common";

import type { UnsafeImageCheck, UnsafeImageVerdict } from "./vision.types";

/**
 * v1 stub (T034 plan Safety statement / R7): logs that a pre-check ran on
 * the processed bytes for `key` and always returns `"ok"` — no blocking, no
 * external call. Real detection is owned by T038 (red-team detector) and
 * T052 (moderation hardening); the `UNSAFE_IMAGE_CHECK` DI seam lets a real
 * implementation replace this stub with zero pipeline changes.
 */
@Injectable()
export class LogOnlyUnsafeImageCheck implements UnsafeImageCheck {
  private readonly logger = new Logger(LogOnlyUnsafeImageCheck.name);

  async check(input: { bytes: Buffer; key: string }): Promise<UnsafeImageVerdict> {
    this.logger.log(`unsafe-image pre-check ran (log-only v1) for key ${input.key}`);
    return { verdict: "ok" };
  }
}
