import fs from "node:fs";
import path from "node:path";

import { PRIVACY_REVIEW_TOPICS, TERMS_REVIEW_TOPICS } from "../legal/legal-document";
import { allFoodPagePaths } from "../food/params";

const WEB_ROOT = path.join(__dirname, "..", "..");
const NEXT_DIR = path.join(WEB_ROOT, ".next");
const MANIFEST_PATH = path.join(NEXT_DIR, "prerender-manifest.json");

interface PrerenderManifest {
  version: number;
  routes: Record<string, unknown>;
}

function readManifest(): PrerenderManifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as PrerenderManifest;
}

function readBuiltHtml(fileName: string): string {
  const filePath = path.join(NEXT_DIR, "server", "app", fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`could not find ${filePath} — run \`pnpm --filter @bombaypetcompany/web build\` first`);
  }
  return fs.readFileSync(filePath, "utf-8");
}

describe("build-output — prerequisite", () => {
  it("the prerender manifest exists (run `pnpm --filter @bombaypetcompany/web build` first)", () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
  });
});

interface NewestSource {
  path: string;
  mtimeMs: number;
}

/**
 * Walks `apps/web/src` and `apps/web/app`, skipping `node_modules`, `.next`,
 * and any `*.spec.ts`/`*.spec.tsx` (editing a spec needs no rebuild — specs
 * must not trip the guard), and returns the newest source file's mtime.
 */
function newestNonSpecSource(): NewestSource {
  let newest: NewestSource = { path: "(none)", mtimeMs: -1 };

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".next") continue;
        walk(fullPath);
      } else if (!/\.spec\.tsx?$/.test(entry.name)) {
        const mtimeMs = fs.statSync(fullPath).mtimeMs;
        if (mtimeMs > newest.mtimeMs) {
          newest = { path: fullPath, mtimeMs };
        }
      }
    }
  }

  walk(path.join(WEB_ROOT, "src"));
  walk(path.join(WEB_ROOT, "app"));
  return newest;
}

describe("build-output — freshness", () => {
  it("the .next build is newer than every non-spec source file (turbo-bypass guard)", () => {
    const newest = newestNonSpecSource();
    const manifestMtimeMs = fs.statSync(MANIFEST_PATH).mtimeMs;
    if (manifestMtimeMs < newest.mtimeMs) {
      throw new Error(
        `.next is stale: ${newest.path} is newer than the build output — run \`pnpm --filter @bombaypetcompany/web build\` (the root \`pnpm test\` chains it via turbo)`,
      );
    }
    expect(manifestMtimeMs).not.toBeLessThan(newest.mtimeMs);
  });
});

describe("AC1 — the build prerendered /, /privacy and /terms", () => {
  it("all three static keys are present in the manifest", () => {
    const manifest = readManifest();
    expect(manifest.routes["/"]).toBeDefined();
    expect(manifest.routes["/privacy"]).toBeDefined();
    expect(manifest.routes["/terms"]).toBeDefined();
  });

  it("the food route set is unchanged by this task (T085 regression guard)", () => {
    const manifest = readManifest();
    const manifestFoodRoutes = new Set(
      Object.keys(manifest.routes).filter((route) => /^\/can-(dogs|cats)-eat\//.test(route)),
    );
    expect(manifestFoodRoutes).toEqual(new Set(allFoodPagePaths()));
  });

  it("the built marketing HTML files exist and are non-trivial (>2000 bytes)", () => {
    for (const fileName of ["index.html", "privacy.html", "terms.html"]) {
      const html = readBuiltHtml(fileName);
      expect(html.length).toBeGreaterThan(2000);
    }
  });

  it("each marketing page has a <title> under 65 chars, a description meta <=160 chars, a self-referencing canonical, html lang=en and a viewport meta", () => {
    for (const fileName of ["index.html", "privacy.html", "terms.html"]) {
      const html = readBuiltHtml(fileName);
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      expect(titleMatch).not.toBeNull();
      expect(titleMatch![1]!.length).toBeGreaterThan(0);
      expect(titleMatch![1]!.length).toBeLessThan(65);

      const descriptionMatch = html.match(/<meta name="description" content="(.*?)"\/>/);
      expect(descriptionMatch).not.toBeNull();
      expect(descriptionMatch![1]!.length).toBeGreaterThan(0);
      expect(descriptionMatch![1]!.length).toBeLessThanOrEqual(160);

      expect(html).toMatch(/<link rel="canonical" href="https:\/\/bombaypetcompany\.app[^"]*"/);
      expect(html).toContain('<html lang="en"');
      expect(html).toContain('name="viewport"');
    }
  });

  it("no marketing page emits noindex/nofollow", () => {
    for (const fileName of ["index.html", "privacy.html", "terms.html"]) {
      const html = readBuiltHtml(fileName).toLowerCase();
      expect(html).not.toContain("noindex");
      expect(html).not.toContain("nofollow");
    }
  });
});

describe("AC2 — legal pages contain review markers, on the built artefact", () => {
  it("privacy.html and terms.html each contain the literal string LEGAL-REVIEW", () => {
    expect(readBuiltHtml("privacy.html")).toContain("LEGAL-REVIEW");
    expect(readBuiltHtml("terms.html")).toContain("LEGAL-REVIEW");
  });

  it("the built HTML marker count equals the document's topic count", () => {
    const privacyHtml = readBuiltHtml("privacy.html");
    const termsHtml = readBuiltHtml("terms.html");
    const privacyMarkerCount = (privacyHtml.match(/data-testid="legal-review-marker"/g) ?? []).length;
    const termsMarkerCount = (termsHtml.match(/data-testid="legal-review-marker"/g) ?? []).length;
    expect(privacyMarkerCount).toBe(PRIVACY_REVIEW_TOPICS.length);
    expect(termsMarkerCount).toBe(TERMS_REVIEW_TOPICS.length);

    for (const topic of PRIVACY_REVIEW_TOPICS) {
      const count = (privacyHtml.match(new RegExp(`data-legal-review="${topic}"`, "g")) ?? []).length;
      expect(count).toBe(1);
    }
    for (const topic of TERMS_REVIEW_TOPICS) {
      const count = (termsHtml.match(new RegExp(`data-legal-review="${topic}"`, "g")) ?? []).length;
      expect(count).toBe(1);
    }
  });

  it("markers are visible, not hidden", () => {
    for (const fileName of ["privacy.html", "terms.html"]) {
      const html = readBuiltHtml(fileName);
      const markerTags = html.match(/<p data-testid="legal-review-marker"[^>]*>/g) ?? [];
      expect(markerTags.length).toBeGreaterThan(0);
      for (const tag of markerTags) {
        expect(tag).not.toContain("hidden");
        expect(tag).not.toContain("display:none");
        expect(tag).not.toContain("display: none");
        expect(tag).not.toContain("visibility:hidden");
        expect(tag).not.toContain("visibility: hidden");
        expect(tag).not.toContain("sr-only");
      }
      expect(html).toContain(
        "this section is template text and must be reviewed and completed by a qualified lawyer before launch (checkpoint C3).",
      );
    }
  });

  it("the landing page contains no LEGAL-REVIEW marker", () => {
    const html = readBuiltHtml("index.html");
    expect(html).not.toContain("LEGAL-REVIEW");
    expect(html).not.toContain('data-testid="legal-review-marker"');
  });
});
