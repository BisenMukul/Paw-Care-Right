import { computeGrantWindow, isGrantCapReached, resolveGrantExpiry, type ReferralGrantRow } from "./referral-grant.util";
import { REFERRAL_GRANT_MS } from "./referral.constants";

const NOW = new Date("2026-07-30T12:00:00.000Z");

function row(startsAt: Date, expiresAt: Date): ReferralGrantRow {
  return { startsAt, expiresAt };
}

describe("computeGrantWindow (D3)", () => {
  it("first grant starts now and ends +14d", () => {
    const window = computeGrantWindow([], NOW);

    expect(window.startsAt.getTime()).toBe(NOW.getTime());
    expect(window.expiresAt.getTime()).toBe(NOW.getTime() + REFERRAL_GRANT_MS);
  });

  it("a second grant chains from the first grant's expiry (no overlap)", () => {
    const first = computeGrantWindow([], NOW);
    const second = computeGrantWindow([row(first.startsAt, first.expiresAt)], NOW);

    expect(second.startsAt.getTime()).toBe(first.expiresAt.getTime());
    expect(second.expiresAt.getTime()).toBe(first.expiresAt.getTime() + REFERRAL_GRANT_MS);
  });

  it("a grant issued after the previous window lapsed starts at now, not at the stale tip", () => {
    const staleTip = new Date(NOW.getTime() - REFERRAL_GRANT_MS * 5); // long expired
    const existing = row(new Date(staleTip.getTime() - REFERRAL_GRANT_MS), staleTip);

    const window = computeGrantWindow([existing], NOW);

    expect(window.startsAt.getTime()).toBe(NOW.getTime());
    expect(window.expiresAt.getTime()).toBe(NOW.getTime() + REFERRAL_GRANT_MS);
  });
});

describe("resolveGrantExpiry (D4)", () => {
  it("returns null with no grants", () => {
    expect(resolveGrantExpiry([], NOW)).toBeNull();
  });

  it("returns the single active window's expiry", () => {
    const expiresAt = new Date(NOW.getTime() + REFERRAL_GRANT_MS);
    const result = resolveGrantExpiry([row(NOW, expiresAt)], NOW);

    expect(result?.getTime()).toBe(expiresAt.getTime());
  });

  it("folds 3 chained windows into a +42d tip", () => {
    const g1Start = NOW;
    const g1End = new Date(g1Start.getTime() + REFERRAL_GRANT_MS);
    const g2Start = g1End;
    const g2End = new Date(g2Start.getTime() + REFERRAL_GRANT_MS);
    const g3Start = g2End;
    const g3End = new Date(g3Start.getTime() + REFERRAL_GRANT_MS);

    const result = resolveGrantExpiry(
      [row(g2Start, g2End), row(g1Start, g1End), row(g3Start, g3End)], // deliberately unsorted
      NOW,
    );

    expect(result?.getTime()).toBe(NOW.getTime() + REFERRAL_GRANT_MS * 3);
  });

  it("ignores a window that already expired", () => {
    const expired = row(new Date(NOW.getTime() - REFERRAL_GRANT_MS * 2), new Date(NOW.getTime() - REFERRAL_GRANT_MS));

    expect(resolveGrantExpiry([expired], NOW)).toBeNull();
  });

  it("ignores a future window with a gap before it", () => {
    // A grant that starts strictly AFTER `now` -- meaning the chain from
    // `now` already lapsed before this window begins -- must not extend the
    // reported tip (D9: an unclaimed/gapped window is not "active" coverage).
    const gapped = row(
      new Date(NOW.getTime() + REFERRAL_GRANT_MS),
      new Date(NOW.getTime() + REFERRAL_GRANT_MS * 2),
    );

    expect(resolveGrantExpiry([gapped], NOW)).toBeNull();
  });
});

describe("isGrantCapReached (D5/D6 boundary)", () => {
  it.each([
    [0, false],
    [1, false],
    [2, false],
    [3, true],
    [4, true],
  ])("existingCount=%i -> %p", (count, expected) => {
    expect(isGrantCapReached(count)).toBe(expected);
  });
});
