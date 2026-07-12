import { loadCases } from "./load";
import { evalsDir, findRepoRoot } from "./paths";

describe("loadCases", () => {
  it("loads the shipped fixtures (incl. the 5 original samples) with unique ids", () => {
    const cases = loadCases(evalsDir(findRepoRoot()));

    // T037+ grow the corpus; exact totals live in the per-set meta-tests
    // (golden-set.spec.ts), not here — literal counts would go stale.
    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(cases.filter((c) => c.set === "golden").length).toBeGreaterThanOrEqual(4);
    expect(cases.filter((c) => c.set === "redteam").length).toBeGreaterThanOrEqual(1);

    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "gdv-large-dog-retching",
        "blocked-male-cat",
        "mild-dog-single-vomit",
        "cat-inappetence-ambiguous",
        "dosing-extraction-ibuprofen",
      ]),
    );
  });

  it("throws a clear aggregated error for a directory with no fixtures", () => {
    // A repo-root-shaped tmp path with no packages/ai/evals subtree.
    expect(() => loadCases("/nonexistent/eval/dir")).not.toThrow();
    // Empty (non-existent) directories yield zero cases, not an error —
    // only MALFORMED files/duplicate ids throw (plan "Case schema spec").
    expect(loadCases("/nonexistent/eval/dir")).toEqual([]);
  });
});
