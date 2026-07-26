import fs from "node:fs";
import path from "node:path";

/**
 * T097 plan AC2 (web half). Unlike mobile (where each `app/**\/*.tsx` file
 * IS a screen), every web route (`apps/web/app/**\/page.tsx`) is a thin
 * Next.js wrapper around one of three shared view components
 * (`LandingView`, `LegalDocumentView`, `FoodPageView`), and those three
 * components' rendered markup is ALREADY exhaustively asserted for the
 * `<VetDisclaimer/>` testid by `marketing/render.spec.tsx` (landing +
 * privacy + terms, "3/3 pages") and `food/render.spec.tsx` (all 466
 * dog/cat x toxin combinations, "count === ALL_PAGES.length"). Per plan step
 * 11, this file does NOT re-render those pages (that would duplicate
 * identical assertions) — it instead statically proves two things no
 * existing spec proves: (1) every actual Next.js *route* in `app/` really
 * does route to one of the three already-covered view components, so no
 * page view is silently missing disclaimer coverage, and (2) the two
 * existing render specs' own coverage claims are the exhaustive ones this
 * report relies on (a cross-check on the spec source, mirroring
 * `a11y-static-scan.test.ts`'s doc<->test [AUTO]-tag cross-check pattern in
 * spirit — checking a claim against the file that makes it, not
 * re-implementing the claim).
 *
 * Page -> covering-spec inventory (stated here for the report, AC2):
 *  - `app/page.tsx` (landing)        -> `marketing/render.spec.tsx` ("3/3 pages")
 *  - `app/privacy/page.tsx`          -> `marketing/render.spec.tsx` ("3/3 pages")
 *  - `app/terms/page.tsx`            -> `marketing/render.spec.tsx` ("3/3 pages")
 *  - `app/can-dogs-eat/[item]/page.tsx` -> `food/render.spec.tsx` (all 466 pages)
 *  - `app/can-cats-eat/[item]/page.tsx` -> `food/render.spec.tsx` (all 466 pages)
 */

const APP_DIR = path.join(__dirname, "..", "app");
const COMPONENTS_DIR = path.join(__dirname, "components");

function collectFiles(dir: string, extension: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, extension, acc);
    } else if (entry.name.endsWith(extension)) {
      acc.push(full);
    }
  }
  return acc;
}

const ALL_PAGE_FILES = collectFiles(APP_DIR, "page.tsx");
const ALL_COMPONENT_FILES = collectFiles(COMPONENTS_DIR, ".tsx");

// Same space-required convention as the mobile placement scan: every real
// JSX call site in this codebase is `<VetDisclaimer />` (with a space);
// prose mentions explaining a NON-render are written `<VetDisclaimer/>`
// (no space).
const JSX_RENDER_PATTERN = /<VetDisclaimer\s+\/>/;

// The three shared view components already exhaustively covered by the two
// existing render specs (T097 plan step 11's "cite it in the report instead
// of duplicating").
const COVERED_VIEW_COMPONENTS = ["LandingView", "LegalDocumentView", "FoodPageView"];

function importedViewComponent(pageSource: string): string | undefined {
  return COVERED_VIEW_COMPONENTS.find(
    (componentName) =>
      new RegExp(`import\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}`).test(pageSource) &&
      new RegExp(`<${componentName}\\b`).test(pageSource),
  );
}

describe("disclaimer-placement: every web route renders an already-covered disclaimer view", () => {
  it("visited a non-trivial number of app/**/page.tsx and src/components/**/*.tsx files (non-vacuity)", () => {
    expect(ALL_PAGE_FILES.length).toBeGreaterThanOrEqual(5);
    expect(ALL_COMPONENT_FILES.length).toBeGreaterThan(5);
  });

  it("every app/**/page.tsx route imports AND renders exactly one of the three covered view components", () => {
    const uncovered: string[] = [];
    for (const file of ALL_PAGE_FILES) {
      const source = fs.readFileSync(file, "utf-8");
      const component = importedViewComponent(source);
      if (component === undefined) {
        uncovered.push(file);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it("the pinned route -> covered-view mapping matches today's 5 routes exactly", () => {
    const mapping = new Map(
      ALL_PAGE_FILES.map((file) => [path.relative(path.join(__dirname, ".."), file).replaceAll("\\", "/"), importedViewComponent(fs.readFileSync(file, "utf-8"))]),
    );
    expect(mapping).toEqual(
      new Map([
        ["app/page.tsx", "LandingView"],
        ["app/privacy/page.tsx", "LegalDocumentView"],
        ["app/terms/page.tsx", "LegalDocumentView"],
        ["app/can-dogs-eat/[item]/page.tsx", "FoodPageView"],
        ["app/can-cats-eat/[item]/page.tsx", "FoodPageView"],
      ]),
    );
  });

  it("exactly the three covered view components render <VetDisclaimer/> directly; no other src/components file does", () => {
    const renderingComponents = ALL_COMPONENT_FILES.filter((file) =>
      JSX_RENDER_PATTERN.test(fs.readFileSync(file, "utf-8")),
    ).map((file) => path.basename(file));

    expect(new Set(renderingComponents)).toEqual(
      new Set(["landing-view.tsx", "legal-document-view.tsx", "food-page-view.tsx"]),
    );
  });

  it("the JSX-render pattern genuinely matches a planted usage and does not match a mere comment mention (non-vacuity proof)", () => {
    expect(JSX_RENDER_PATTERN.test("        <VetDisclaimer />\n")).toBe(true);
    expect(JSX_RENDER_PATTERN.test("// this preview never renders `<VetDisclaimer/>`-style output")).toBe(false);
  });

  it("cross-check: marketing/render.spec.tsx's own coverage claim asserts all 3 pages (landing + privacy + terms)", () => {
    const marketingSpecSource = fs.readFileSync(path.join(__dirname, "marketing", "render.spec.tsx"), "utf-8");
    expect(marketingSpecSource).toContain('describe("all three pages render the non-dismissible <VetDisclaimer/>"');
    expect(marketingSpecSource).toContain("expect(count).toBe(3);");
    expect(marketingSpecSource).toContain("const ALL_PAGES = [landingMarkup, privacyMarkup, termsMarkup];");
  });

  it("cross-check: food/render.spec.tsx's own coverage claim asserts every one of the 466 rendered pages", () => {
    const foodSpecSource = fs.readFileSync(path.join(__dirname, "food", "render.spec.tsx"), "utf-8");
    expect(foodSpecSource).toContain('it("every page renders the non-dismissible <VetDisclaimer/>"');
    expect(foodSpecSource).toContain("expect(count).toBe(ALL_PAGES.length);");
  });
});
