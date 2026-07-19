/**
 * Pure, `now`-injected date helpers for the demo seed (SEEDER-1 plan).
 *
 * Every function here is total and deterministic given its arguments — no
 * `Math.random`, no bare `Date.now()`/`new Date()` (the seed's single call
 * to `new Date()` lives in `../seed.ts`'s `runSeed`, which then threads
 * that one `now` through every builder), no `Intl`. Re-running the whole
 * seed with the SAME `now` therefore reproduces byte-identical dates.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC on `now`'s calendar day. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

/** `n` whole days before `now`'s UTC midnight (`n=0` === `startOfUtcDay(now)`). */
export function daysAgo(now: Date, n: number): Date {
  return new Date(startOfUtcDay(now).getTime() - n * MS_PER_DAY);
}

/** `n` whole days after `now`'s UTC midnight. */
export function daysFromNow(now: Date, n: number): Date {
  return new Date(startOfUtcDay(now).getTime() + n * MS_PER_DAY);
}

/** `now`'s calendar day at a fixed UTC `hour` (0-23). */
export function todayAtHourUtc(now: Date, hour: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0, 0));
}
