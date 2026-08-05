import { collectLeafPaths } from "./resolve";
import {
  PSEUDO_CLOSE,
  PSEUDO_OPEN,
  RTL_MARK,
  isPseudoTransformed,
  pseudoString,
  pseudoTree,
  rtlPseudoString,
} from "./pseudo";

describe("pseudoString", () => {
  it("accents letters and brackets the result", () => {
    expect(pseudoString("Home")).toBe("⟦Ĥöṁé⟧");
  });

  it("leaves non-letters (digits, punctuation) untouched inside the brackets", () => {
    expect(pseudoString("Step 1 of 3!")).toContain("1");
    expect(pseudoString("Step 1 of 3!")).toContain("3!");
  });

  it("is marked as pseudo-transformed", () => {
    expect(isPseudoTransformed(pseudoString("anything"))).toBe(true);
  });
});

describe("rtlPseudoString", () => {
  it("wraps the pseudo-string in RLM marks", () => {
    const result = rtlPseudoString("Home");
    expect(result.startsWith(RTL_MARK)).toBe(true);
    expect(result.endsWith(RTL_MARK)).toBe(true);
    expect(result).toContain(pseudoString("Home"));
  });
});

describe("isPseudoTransformed", () => {
  it("is false for plain English text", () => {
    expect(isPseudoTransformed("Home")).toBe(false);
  });

  it("requires both markers", () => {
    expect(isPseudoTransformed(PSEUDO_OPEN)).toBe(false);
    expect(isPseudoTransformed(PSEUDO_CLOSE)).toBe(false);
    expect(isPseudoTransformed(`${PSEUDO_OPEN}x${PSEUDO_CLOSE}`)).toBe(true);
  });
});

describe("pseudoTree", () => {
  const tree = {
    tabs: { home: "Home", care: "Care" },
    greet: (name: string, times: number) => `Hi ${name} x${times}`,
    list: ["a", "b"] as const,
  };

  it("transforms every string leaf", () => {
    const transformed = pseudoTree(tree, pseudoString);
    expect(isPseudoTransformed(transformed.tabs.home)).toBe(true);
    expect(isPseudoTransformed(transformed.tabs.care)).toBe(true);
  });

  it("wraps function leaves so their RESULT is transformed", () => {
    const transformed = pseudoTree(tree, pseudoString);
    expect(isPseudoTransformed(transformed.greet("Ana", 2))).toBe(true);
  });

  it("preserves function arity (fn.length)", () => {
    const transformed = pseudoTree(tree, pseudoString);
    expect(transformed.greet.length).toBe(tree.greet.length);
  });

  it("transforms array items element-wise", () => {
    const transformed = pseudoTree(tree, pseudoString);
    expect(transformed.list.every(isPseudoTransformed)).toBe(true);
  });

  it("never mutates the input tree", () => {
    const before = JSON.stringify({ tabs: tree.tabs, list: tree.list });
    pseudoTree(tree, pseudoString);
    expect(JSON.stringify({ tabs: tree.tabs, list: tree.list })).toBe(before);
  });

  it("100% of collected leaves are transformed (non-vacuity)", () => {
    const transformed = pseudoTree(tree, pseudoString);
    const paths = collectLeafPaths(tree);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      // resolve the same path on both trees
      const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".");
      let originalNode: unknown = tree;
      let transformedNode: unknown = transformed;
      for (const segment of segments) {
        originalNode = (originalNode as Record<string, unknown>)[segment];
        transformedNode = (transformedNode as Record<string, unknown>)[segment];
      }
      if (typeof originalNode === "function") {
        const result = (transformedNode as (...args: unknown[]) => string)(
          ...Array.from({ length: (originalNode as (...a: unknown[]) => unknown).length }, () => "x"),
        );
        expect(isPseudoTransformed(result)).toBe(true);
      } else {
        expect(isPseudoTransformed(transformedNode as string)).toBe(true);
      }
    }
    // an untransformed control string fails the same predicate
    expect(isPseudoTransformed("an untransformed control string")).toBe(false);
  });
});
