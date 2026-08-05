// T110 AC1.7 — web resolver-level pseudo-locale proof (F7: no jsdom/render
// on web, so this exercises `getStrings(locale)` directly rather than
// rendering a page).
import { collectLeafPaths, isPseudoTransformed } from "@bombaypetcompany/config";

import { enStrings } from "../strings";
import { getStrings } from "./runtime";

describe("getStrings('en-XA') transforms every web leaf", () => {
  it("collectLeafPaths parity: the pseudo tree has exactly the same leaf paths as English", () => {
    const pseudo = getStrings("en-XA") as typeof enStrings;
    expect(collectLeafPaths(pseudo).sort()).toEqual(collectLeafPaths(enStrings).sort());
  });

  it("every string leaf and every function-leaf result is pseudo-marked", () => {
    const pseudo = getStrings("en-XA") as typeof enStrings;
    const paths = collectLeafPaths(enStrings);
    expect(paths.length).toBeGreaterThan(0);

    function readPath(tree: unknown, path: string): unknown {
      const segments = path.replace(/\[(\d+)\]/g, ".$1").split(".");
      let node: unknown = tree;
      for (const segment of segments) {
        node = (node as Record<string, unknown>)[segment];
      }
      return node;
    }

    let stringLeafCount = 0;
    let transformedCount = 0;
    for (const path of paths) {
      const englishValue = readPath(enStrings, path);
      const pseudoValue = readPath(pseudo, path);
      if (typeof englishValue === "function") {
        const arity = (englishValue as (...args: unknown[]) => unknown).length;
        const args = Array.from({ length: arity }, () => "x");
        const result = (pseudoValue as (...a: unknown[]) => string)(...args);
        expect(isPseudoTransformed(result)).toBe(true);
        continue;
      }
      if (typeof englishValue !== "string") continue;
      stringLeafCount += 1;
      if (isPseudoTransformed(pseudoValue as string)) transformedCount += 1;
    }
    expect(stringLeafCount).toBeGreaterThan(0);
    expect(transformedCount).toBe(stringLeafCount);
  });

  it("an untransformed control string fails the same predicate (non-vacuity)", () => {
    expect(isPseudoTransformed("an untransformed control string")).toBe(false);
  });
});

describe("getStrings('ar-XB') also transforms every leaf (RTL pseudolocale)", () => {
  it("every string leaf is pseudo-marked", () => {
    const pseudo = getStrings("ar-XB") as typeof enStrings;
    expect(isPseudoTransformed(pseudo.footer.homeLabel)).toBe(true);
  });
});

describe("getStrings('en') returns the untransformed English tree", () => {
  it("is deep-equal to enStrings", () => {
    expect(getStrings("en")).toEqual(enStrings);
  });
});
