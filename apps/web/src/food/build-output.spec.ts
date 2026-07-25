import fs from "node:fs";
import path from "node:path";

import { toxins } from "@pawcareright/data";

import sitemap from "../../app/sitemap";
import robots from "../../app/robots";
import { SITE_URL } from "../site";
import { allFoodPagePaths, FOOD_PAGE_COUNT } from "./params";
import { SPECIES_SEGMENTS } from "./species";

// This whole file reads Next's real build output (D12: apps/web's `test`
// task depends on its own `build`). If the manifest is missing, every test
// below FAILS loudly with an actionable message — it never silently skips.
const WEB_ROOT = path.join(__dirname, "..", "..");
const NEXT_DIR = path.join(WEB_ROOT, ".next");
const MANIFEST_PATH = path.join(NEXT_DIR, "prerender-manifest.json");

interface PrerenderManifest {
  version: number;
  routes: Record<string, unknown>;
  dynamicRoutes: Record<string, { fallback: boolean | string | null }>;
}

function readManifest(): PrerenderManifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8")) as PrerenderManifest;
}

/** Finds the prerendered HTML file for one generated page, wherever Next put it. */
function findBuiltHtml(segment: string, itemId: string): string {
  const direct = path.join(NEXT_DIR, "server", "app", segment, `${itemId}.html`);
  if (fs.existsSync(direct)) {
    return fs.readFileSync(direct, "utf-8");
  }
  // Fallback: search recursively (D12/R8 — never convert this into a skip).
  const appDir = path.join(NEXT_DIR, "server", "app");
  const stack: string[] = [appDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name === `${itemId}.html` && full.includes(segment)) {
        return fs.readFileSync(full, "utf-8");
      }
    }
  }
  throw new Error(
    `could not find built HTML for ${segment}/${itemId} under ${appDir} — run \`pnpm --filter @pawcareright/web build\` first`,
  );
}

describe("build-output — prerequisite", () => {
  it("the prerender manifest exists (run `pnpm --filter @pawcareright/web build` first)", () => {
    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
  });
});

describe("AC1 — build prerendered every /can-*-eat/* route", () => {
  it("the manifest's food route set equals allFoodPagePaths() (both directions)", () => {
    const manifest = readManifest();
    const manifestFoodRoutes = new Set(
      Object.keys(manifest.routes).filter((route) => /^\/can-(dogs|cats)-eat\//.test(route)),
    );
    const expected = new Set(allFoodPagePaths());
    expect(manifestFoodRoutes).toEqual(expected);
  });

  it("no food route is on-demand (dynamicParams = false ⇒ fallback: false, D3)", () => {
    const manifest = readManifest();
    for (const segment of SPECIES_SEGMENTS) {
      const entry = manifest.dynamicRoutes[`/${segment}/[item]`];
      expect(entry).toBeDefined();
      expect(entry!.fallback).toBe(false);
    }
  });

  it("sitemap.xml contains every generated page", () => {
    const entries = sitemap();
    expect(entries.length).toBe(3 + FOOD_PAGE_COUNT);

    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith(SITE_URL)).toBe(true);
    }

    const foodUrls = new Set(urls.filter((u) => /\/can-(dogs|cats)-eat\//.test(u)));
    const expectedFoodUrls = new Set(allFoodPagePaths().map((p) => `${SITE_URL}${p}`));
    expect(foodUrls).toEqual(expectedFoodUrls);
  });
});

describe("AC2 — SEO contract on the 12-pair sample's built HTML", () => {
  const SAMPLE: Array<{ segment: "can-dogs-eat" | "can-cats-eat"; itemId: string }> = [
    { segment: "can-dogs-eat", itemId: "grapes" },
    { segment: "can-cats-eat", itemId: "true-lilies" },
    { segment: "can-dogs-eat", itemId: "chocolate" },
    { segment: "can-cats-eat", itemId: "onion" },
    { segment: "can-dogs-eat", itemId: "onion" },
    { segment: "can-cats-eat", itemId: "chocolate" },
    { segment: "can-cats-eat", itemId: "xylitol" },
    { segment: "can-dogs-eat", itemId: "true-lilies" },
    { segment: "can-cats-eat", itemId: "grapes" },
    { segment: "can-dogs-eat", itemId: "apple" },
    { segment: "can-cats-eat", itemId: "banana" },
    { segment: "can-dogs-eat", itemId: "watermelon" },
  ];

  it("every sample page has a non-empty <title> under 65 characters", () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      const match = html.match(/<title>(.*?)<\/title>/);
      expect(match).not.toBeNull();
      const title = match![1]!;
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThan(65);
    }
  });

  it('every sample page has a non-empty <meta name="description"> at most 160 characters', () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      const match = html.match(/<meta name="description" content="(.*?)"\/>/);
      expect(match).not.toBeNull();
      const description = match![1]!;
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(160);
    }
  });

  it('every sample page has <link rel="canonical"> pointing at its own absolute SITE_URL path', () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/${segment}/${itemId}"`);
    }
  });

  it('every sample page has <html lang="en"> and a viewport meta', () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      expect(html).toContain('<html lang="en"');
      expect(html).toContain('name="viewport"');
    }
  });

  it("no sample page emits noindex/nofollow", () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      expect(html.toLowerCase()).not.toContain("noindex");
      expect(html.toLowerCase()).not.toContain("nofollow");
    }
  });

  it("every <a> in a sample page has non-empty text and an href", () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      const anchors = html.match(/<a\s[^>]*>[^<]*<\/a>/g) ?? [];
      expect(anchors.length).toBeGreaterThan(0);
      for (const anchor of anchors) {
        expect(anchor).toMatch(/href="[^"]+"/);
        const textMatch = anchor.match(/>([^<]*)<\/a>/);
        expect(textMatch).not.toBeNull();
        expect(textMatch![1]!.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("no <img> without alt (count of <img equals count of <img ... alt=)", () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      const imgCount = (html.match(/<img /g) ?? []).length;
      const imgWithAltCount = (html.match(/<img\b[^>]*\balt=/g) ?? []).length;
      expect(imgWithAltCount).toBe(imgCount);
    }
  });

  it("robots.txt allows crawling and points at the sitemap", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules.some((rule) => rule.userAgent === "*" && rule.allow === "/")).toBe(true);
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("lighthouserc asserts categories:seo at ≥0.95 and collects at least one /can-…-eat/ URL", () => {
    const lighthouserc = JSON.parse(
      fs.readFileSync(path.join(WEB_ROOT, "lighthouserc.json"), "utf-8"),
    ) as {
      ci: {
        collect: { url: string[] };
        assert: { assertions: Record<string, unknown> };
      };
    };

    const assertion = lighthouserc.ci.assert.assertions["categories:seo"] as [string, { minScore: number }];
    expect(assertion[0]).toBe("error");
    expect(assertion[1].minScore).toBeGreaterThanOrEqual(0.95);
    expect(lighthouserc.ci.collect.url.some((url) => /\/can-[a-z]+-eat\//.test(url))).toBe(true);
  });
});

describe("AC3 — hotline CTA sample on built HTML (consistency with render.spec.tsx)", () => {
  const SAMPLE: Array<{ segment: "can-dogs-eat" | "can-cats-eat"; itemId: string }> = [
    { segment: "can-dogs-eat", itemId: "grapes" },
    { segment: "can-cats-eat", itemId: "true-lilies" },
    { segment: "can-dogs-eat", itemId: "chocolate" },
    { segment: "can-cats-eat", itemId: "onion" },
    { segment: "can-dogs-eat", itemId: "apple" },
    { segment: "can-cats-eat", itemId: "banana" },
  ];

  it("toxic/emergency sample pages render the pre-h1 CTA; safe sample pages don't", () => {
    for (const { segment, itemId } of SAMPLE) {
      const row = toxins.find((t) => t.id === itemId)!;
      const verdictKey = segment === "can-dogs-eat" ? "dog" : "cat";
      const verdict = row.verdicts[verdictKey];
      const html = findBuiltHtml(segment, itemId);
      const hasCta = html.includes('data-testid="emergency-hotline-cta"');
      expect(hasCta).toBe(verdict === "toxic" || verdict === "emergency");
    }
  });

  it("every sample page (any verdict) includes the R4 informational hotline section", () => {
    for (const { segment, itemId } of SAMPLE) {
      const html = findBuiltHtml(segment, itemId);
      expect(html).toContain('data-testid="hotline-info-section"');
    }
  });
});
