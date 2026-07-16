import { assignPaywallVariant, fnv1a32 } from "./variant-assignment";

describe("fnv1a32", () => {
  it("is a pure, deterministic 32-bit unsigned hash", () => {
    const a = fnv1a32("hello-world");
    const b = fnv1a32("hello-world");

    expect(a).toBe(b);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
  });

  it("hashes different inputs to different values (no trivial collisions on close inputs)", () => {
    expect(fnv1a32("user-1")).not.toBe(fnv1a32("user-2"));
  });
});

describe("assignPaywallVariant — deterministic (AC)", () => {
  it("(a) returns the same variant for the same userId across many repeated calls", () => {
    const userId = "user-repeat-check";
    const results = new Set(
      Array.from({ length: 50 }, () => assignPaywallVariant(userId, "AUTO")),
    );

    expect(results.size).toBe(1);
  });

  it("(b) distribution sanity — both A and B appear over 1000 synthetic ids, within a loose 40-60% band", () => {
    const counts: Record<"A" | "B", number> = { A: 0, B: 0 };

    for (let i = 0; i < 1000; i += 1) {
      const variant = assignPaywallVariant(`synthetic-user-${i}`, "AUTO");
      counts[variant] += 1;
    }

    expect(counts.A).toBeGreaterThan(0);
    expect(counts.B).toBeGreaterThan(0);
    expect(counts.A).toBeGreaterThanOrEqual(400);
    expect(counts.A).toBeLessThanOrEqual(600);
    expect(counts.B).toBeGreaterThanOrEqual(400);
    expect(counts.B).toBeLessThanOrEqual(600);
  });

  it("(c) env override 'A' wins regardless of userId", () => {
    expect(assignPaywallVariant("user-golden-pin-002", "A")).toBe("A");
    expect(assignPaywallVariant(undefined, "A")).toBe("A");
  });

  it("(c) env override 'B' wins regardless of userId", () => {
    expect(assignPaywallVariant("user-golden-pin-001", "B")).toBe("B");
    expect(assignPaywallVariant(undefined, "B")).toBe("B");
  });

  it("(d) 'AUTO' with no userId returns the stable anonymous default 'A'", () => {
    expect(assignPaywallVariant(undefined, "AUTO")).toBe("A");
    expect(assignPaywallVariant("", "AUTO")).toBe("A");
  });

  it("(e) golden pair — a pinned (userId -> variant) so the hash can't silently change", () => {
    expect(fnv1a32("user-golden-pin-002")).toBe(3615821);
    expect(assignPaywallVariant("user-golden-pin-002", "AUTO")).toBe("B");
    expect(assignPaywallVariant("user-golden-pin-001", "AUTO")).toBe("A");
  });
});
