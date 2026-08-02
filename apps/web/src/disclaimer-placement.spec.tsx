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
 *
 * T111 amendment (plan step 25 / risk R4 — "the most dangerous edit here"):
 * `/admin*` is an internal, read-only reporting surface that shows NO §5
 * AI-result content (no triage output, no symptom intake, no dosing/urgency
 * language) — it therefore needs no `<VetDisclaimer/>` at all, unlike every
 * other route above. The carve-out below is intentionally NARROW: exactly
 * the three admin routes, named in `ADMIN_ROUTES` (never a directory glob),
 * each mapped EXPLICITLY to its own admin view component in the pinned
 * mapping test (the map still can never silently grow), PLUS a new,
 * compensating assertion that no admin page or admin view source even
 * references a §5 surface token (`TriageResult`/`resultJson`/`intakeJson`/
 * `urgency`/`symptom`/`VetDisclaimer`) — proving the missing disclaimer is a
 * deliberate, sound scope decision, not a hole. The original rule is left
 * fully in force for every non-admin route (still asserted at >= 5 files
 * below), so a new NON-admin route that forgets a covered view still fails
 * this spec exactly as before.
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

// T111: the three admin routes, named exactly (never a directory glob) —
// excluded from the "imports one of the 3 covered marketing views" rule
// because they legitimately import a DIFFERENT, admin-only view component
// instead (see `ADMIN_VIEW_COMPONENTS` below).
const ADMIN_ROUTES: ReadonlySet<string> = new Set([
  "app/admin/page.tsx",
  "app/admin/users/page.tsx",
  "app/admin/audit/page.tsx",
]);

const ADMIN_VIEW_COMPONENTS = ["AdminKpisView", "AdminUserLookupView", "AdminAuditView"];

// T111 step 25(c): no admin page or admin view source may even reference a
// §5 AI-result surface token — proving the missing `<VetDisclaimer/>` above
// is a sound "this surface shows no §5 content" decision, not an oversight.
// Word-bounded so it does NOT false-positive on the D4 counter field names
// `symptomChecksTotal`/`symptomChecksFallback` (legitimate ids/codes/counts,
// per `packages/types/src/admin.ts`) — `\bsymptom\b` requires a boundary
// immediately after "symptom", which a following capital letter in a
// camelCase identifier never provides.
const SAFETY_SURFACE_TOKEN_PATTERN = /\b(TriageResult|resultJson|intakeJson|urgency|symptom|VetDisclaimer)\b/;

function importedViewComponent(pageSource: string, candidates: readonly string[]): string | undefined {
  return candidates.find(
    (componentName) =>
      new RegExp(`import\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}`).test(pageSource) &&
      new RegExp(`<${componentName}\\b`).test(pageSource),
  );
}

function relativePath(file: string): string {
  return path.relative(path.join(__dirname, ".."), file).replaceAll("\\", "/");
}

const NON_ADMIN_PAGE_FILES = ALL_PAGE_FILES.filter((file) => !ADMIN_ROUTES.has(relativePath(file)));
const ADMIN_PAGE_FILES = ALL_PAGE_FILES.filter((file) => ADMIN_ROUTES.has(relativePath(file)));
// Excludes `.spec.tsx` files: a test file legitimately mentions these
// tokens (e.g. asserting the disclaimer testid is ABSENT) without being
// "admin view source" itself.
const ADMIN_COMPONENT_FILES = ALL_COMPONENT_FILES.filter(
  (file) =>
    path.relative(COMPONENTS_DIR, file).replaceAll("\\", "/").startsWith("admin/") && !file.endsWith(".spec.tsx"),
);

describe("disclaimer-placement: every web route renders an already-covered disclaimer view", () => {
  it("visited a non-trivial number of app/**/page.tsx and src/components/**/*.tsx files (non-vacuity)", () => {
    expect(ALL_PAGE_FILES.length).toBeGreaterThanOrEqual(5);
    expect(ALL_COMPONENT_FILES.length).toBeGreaterThan(5);
  });

  it("ADMIN_ROUTES names exactly 3 routes (the carve-out can never silently widen)", () => {
    expect(ADMIN_ROUTES.size).toBe(3);
  });

  it("every NON-admin app/**/page.tsx route (still >= 5 files) imports AND renders exactly one of the three covered view components", () => {
    expect(NON_ADMIN_PAGE_FILES.length).toBeGreaterThanOrEqual(5);

    const uncovered: string[] = [];
    for (const file of NON_ADMIN_PAGE_FILES) {
      const source = fs.readFileSync(file, "utf-8");
      const component = importedViewComponent(source, COVERED_VIEW_COMPONENTS);
      if (component === undefined) {
        uncovered.push(file);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it("every admin route imports AND renders its own admin view component (the carve-out, not a hole)", () => {
    expect(ADMIN_PAGE_FILES).toHaveLength(3);

    const uncovered: string[] = [];
    for (const file of ADMIN_PAGE_FILES) {
      const source = fs.readFileSync(file, "utf-8");
      const component = importedViewComponent(source, ADMIN_VIEW_COMPONENTS);
      if (component === undefined) {
        uncovered.push(file);
      }
    }
    expect(uncovered).toEqual([]);
  });

  it("the pinned route -> covered-view mapping matches today's 5 marketing routes + 3 admin routes exactly", () => {
    const mapping = new Map(
      ALL_PAGE_FILES.map((file) => {
        const relative = relativePath(file);
        const source = fs.readFileSync(file, "utf-8");
        const candidates = ADMIN_ROUTES.has(relative) ? ADMIN_VIEW_COMPONENTS : COVERED_VIEW_COMPONENTS;
        return [relative, importedViewComponent(source, candidates)];
      }),
    );
    expect(mapping).toEqual(
      new Map([
        ["app/page.tsx", "LandingView"],
        ["app/privacy/page.tsx", "LegalDocumentView"],
        ["app/terms/page.tsx", "LegalDocumentView"],
        ["app/can-dogs-eat/[item]/page.tsx", "FoodPageView"],
        ["app/can-cats-eat/[item]/page.tsx", "FoodPageView"],
        ["app/admin/page.tsx", "AdminKpisView"],
        ["app/admin/users/page.tsx", "AdminUserLookupView"],
        ["app/admin/audit/page.tsx", "AdminAuditView"],
      ]),
    );
  });

  it("exactly the three covered view components render <VetDisclaimer/> directly; no other src/components file does (admin views included in the negative check)", () => {
    const renderingComponents = ALL_COMPONENT_FILES.filter((file) =>
      JSX_RENDER_PATTERN.test(fs.readFileSync(file, "utf-8")),
    ).map((file) => path.basename(file));

    expect(new Set(renderingComponents)).toEqual(
      new Set(["landing-view.tsx", "legal-document-view.tsx", "food-page-view.tsx"]),
    );
  });

  it("T111: no admin page or admin view source references a §5 AI-result surface token (proves the missing disclaimer is a sound scope decision)", () => {
    expect(ADMIN_PAGE_FILES.length).toBeGreaterThan(0);
    expect(ADMIN_COMPONENT_FILES.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of [...ADMIN_PAGE_FILES, ...ADMIN_COMPONENT_FILES]) {
      const source = fs.readFileSync(file, "utf-8");
      if (SAFETY_SURFACE_TOKEN_PATTERN.test(source)) {
        offenders.push(relativePath(file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the §5 surface-token pattern is word-bounded: it does NOT false-positive on the legitimate `symptomChecksTotal`/`symptomChecksFallback` D4 counter field names", () => {
    expect(SAFETY_SURFACE_TOKEN_PATTERN.test("data.counters.symptomChecksTotal")).toBe(false);
    expect(SAFETY_SURFACE_TOKEN_PATTERN.test("data.counters.symptomChecksFallback")).toBe(false);
  });

  it("the §5 surface-token pattern DOES match a planted positive control (non-vacuity)", () => {
    expect(SAFETY_SURFACE_TOKEN_PATTERN.test("import type { TriageResult } from \"@bombaypetcompany/types\";")).toBe(
      true,
    );
    expect(SAFETY_SURFACE_TOKEN_PATTERN.test("const urgency = result.urgency;")).toBe(true);
    expect(SAFETY_SURFACE_TOKEN_PATTERN.test("<VetDisclaimer />")).toBe(true);
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
