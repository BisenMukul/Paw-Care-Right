import { ABUSE_KEY_PREFIX } from "./abuse.constants";

/** UTC, zero-padded: `YYYY-MM-DDTHH` (mirrors `quota/quota.util.ts`'s `windowBucket`). */
export function hourBucket(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}`;
}

/** `bombaypetcompany:abuse:checks:hour:{userId}:{bucket}` */
export function checksPerHourKey(userId: string, now: Date): string {
  return `${ABUSE_KEY_PREFIX}checks:hour:${userId}:${hourBucket(now)}`;
}
