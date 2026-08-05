import { DEFERRED_ROOT_SEGMENTS, isDeferredFlow } from "../src/ota/update-deferral";

describe("update-deferral: DEFERRED_ROOT_SEGMENTS", () => {
  it("has exactly the 6 documented protected root segments", () => {
    expect(DEFERRED_ROOT_SEGMENTS).toEqual([
      "check",
      "checks",
      "paywall",
      "(auth)",
      "add-pet",
      "push-rationale",
    ]);
  });
});

describe("update-deferral: isDeferredFlow", () => {
  it.each([
    ["check", ["check", "index"]],
    ["check/[category]", ["check", "some-category"]],
    ["check/waiting", ["check", "waiting", "[checkId]"]],
    ["check/result", ["check", "result", "[checkId]"]],
    ["check/emergency (Emergency interstitial)", ["check", "emergency", "[checkId]"]],
    ["check/history", ["check", "history", "[petId]"]],
    ["checks/[id]", ["checks", "[id]"]],
    ["paywall", ["paywall"]],
    ["(auth)/welcome", ["(auth)", "welcome"]],
    ["(auth)/otp", ["(auth)", "otp"]],
    ["add-pet/species", ["add-pet", "species"]],
    ["push-rationale", ["push-rationale"]],
  ])("every protected root segment defers: %s", (_name, segments) => {
    expect(isDeferredFlow(segments)).toBe(true);
  });

  it.each([
    ["(tabs)", ["(tabs)"]],
    ["pets/[id]", ["pets", "[id]"]],
    ["breeds", ["breeds"]],
    ["family", ["family"]],
    ["chat", ["chat"]],
    ["empty segments", []],
    ["a single undefined segment", [undefined]],
  ])("ordinary routes do not defer: %s", (_name, segments) => {
    expect(isDeferredFlow(segments)).toBe(false);
  });
});
