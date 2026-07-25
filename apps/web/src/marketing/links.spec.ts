import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { APP_DISPLAY_NAME, DEEPLINK_SCHEME } from "@pawcareright/config";

import { LegalDocumentView } from "../components/legal/legal-document-view";
import { LandingView } from "../components/marketing/landing-view";
import { allFoodPagePaths } from "../food/params";
import { buildPrivacyDocument } from "../legal/privacy-document";
import { buildTermsDocument } from "../legal/terms-document";
import { knownInternalRoutes, MARKETING_ROUTES } from "../routes";
import { buildLandingModel } from "./landing-content";

const NEXT_DIR = path.join(__dirname, "..", "..", ".next");

interface AnchorInfo {
  href: string;
  text: string;
}

function extractAnchors(markup: string): AnchorInfo[] {
  const anchors: AnchorInfo[] = [];
  const anchorRegex = /<a\s([^>]*)>([^<]*)<\/a>/g;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(markup)) !== null) {
    const attrs = match[1]!;
    const hrefMatch = attrs.match(/href="([^"]*)"/);
    anchors.push({ href: hrefMatch ? hrefMatch[1]! : "", text: match[2]!.trim() });
  }
  return anchors;
}

function findBuiltHtml(fileName: string): string {
  const filePath = path.join(NEXT_DIR, "server", "app", fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`could not find ${filePath} — run \`pnpm --filter @pawcareright/web build\` first`);
  }
  return fs.readFileSync(filePath, "utf-8");
}

// This file stays `.ts` (not `.tsx`) per the plan's file list, so pages are
// rendered via `createElement` rather than JSX syntax.
const landingModel = buildLandingModel(APP_DISPLAY_NAME);
const landingMarkup = renderToStaticMarkup(createElement(LandingView, { model: landingModel }));
const privacyMarkup = renderToStaticMarkup(
  createElement(LegalDocumentView, { document: buildPrivacyDocument(APP_DISPLAY_NAME) }),
);
const termsMarkup = renderToStaticMarkup(
  createElement(LegalDocumentView, { document: buildTermsDocument(APP_DISPLAY_NAME) }),
);

const RENDERED_PAGES: Record<string, string> = {
  landing: landingMarkup,
  privacy: privacyMarkup,
  terms: termsMarkup,
};

const BUILT_PAGES: Record<string, string> = {
  landing: findBuiltHtml("index.html"),
  privacy: findBuiltHtml("privacy.html"),
  terms: findBuiltHtml("terms.html"),
};

describe("AC3 — every internal href resolves to a route the build generates", () => {
  const known = knownInternalRoutes();

  it.each(["landing", "privacy", "terms"])("rendered %s page", (page) => {
    const anchors = extractAnchors(RENDERED_PAGES[page]!);
    for (const { href } of anchors) {
      if (href.startsWith("/")) {
        expect(known.has(href)).toBe(true);
      }
    }
  });

  it.each(["landing", "privacy", "terms"])("built %s page", (page) => {
    const anchors = extractAnchors(BUILT_PAGES[page]!);
    for (const { href } of anchors) {
      if (href.startsWith("/")) {
        expect(known.has(href)).toBe(true);
      }
    }
  });
});

describe("AC3 — every anchor has non-empty visible text", () => {
  it.each(["landing", "privacy", "terms"])("%s", (page) => {
    const anchors = extractAnchors(RENDERED_PAGES[page]!);
    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor.text.length).toBeGreaterThan(0);
    }
  });
});

describe("AC3 — no placeholder or unsafe hrefs", () => {
  it.each(["landing", "privacy", "terms"])("%s", (page) => {
    const anchors = extractAnchors(RENDERED_PAGES[page]!);
    for (const { href } of anchors) {
      expect(href).not.toBe("#");
      expect(href).not.toBe("");
      expect(href.toLowerCase().startsWith("javascript:")).toBe(false);
      expect(href.startsWith("http://")).toBe(false);
    }
  });
});

describe("AC3 — every href matches the allowlisted shapes", () => {
  it.each(["landing", "privacy", "terms"])("%s", (page) => {
    const anchors = extractAnchors(RENDERED_PAGES[page]!);
    for (const { href } of anchors) {
      const isInternalPath = href.startsWith("/");
      const isFragment = /^#[a-z0-9-]+$/.test(href);
      const isMailto = /^mailto:[^@]+@pawcareright\.app$/.test(href);
      const isDeepLink = href.startsWith(`${DEEPLINK_SCHEME}://`);
      expect(isInternalPath || isFragment || isMailto || isDeepLink).toBe(true);
    }
  });
});

describe("AC3 — same-page fragment hrefs have a matching element id", () => {
  it.each(["landing", "privacy", "terms"])("%s", (page) => {
    const markup = RENDERED_PAGES[page]!;
    const anchors = extractAnchors(markup);
    for (const { href } of anchors) {
      if (href.startsWith("#")) {
        const id = href.slice(1);
        expect(markup).toContain(`id="${id}"`);
      }
    }
  });
});

describe("AC3 — the three marketing pages cross-link", () => {
  it("landing links to /privacy and /terms", () => {
    const hrefs = new Set(extractAnchors(landingMarkup).map((a) => a.href));
    expect(hrefs.has(MARKETING_ROUTES.privacy)).toBe(true);
    expect(hrefs.has(MARKETING_ROUTES.terms)).toBe(true);
  });

  it("privacy links to / and /terms", () => {
    const hrefs = new Set(extractAnchors(privacyMarkup).map((a) => a.href));
    expect(hrefs.has(MARKETING_ROUTES.home)).toBe(true);
    expect(hrefs.has(MARKETING_ROUTES.terms)).toBe(true);
  });

  it("terms links to / and /privacy", () => {
    const hrefs = new Set(extractAnchors(termsMarkup).map((a) => a.href));
    expect(hrefs.has(MARKETING_ROUTES.home)).toBe(true);
    expect(hrefs.has(MARKETING_ROUTES.privacy)).toBe(true);
  });
});

describe("AC3 — the popular-answers strip links to exactly 6 distinct existing food pages (D6)", () => {
  it("6 distinct hrefs, all subset of allFoodPagePaths()", () => {
    const valid = new Set(allFoodPagePaths());
    const hrefs = landingModel.popularAnswers.links.map((l) => l.href);
    expect(hrefs).toHaveLength(6);
    expect(new Set(hrefs).size).toBe(6);
    for (const href of hrefs) {
      expect(valid.has(href)).toBe(true);
    }
  });
});

describe("§5.7 — no page links to an app store", () => {
  it.each(["landing", "privacy", "terms"])("%s (rendered + built)", (page) => {
    for (const markup of [RENDERED_PAGES[page]!, BUILT_PAGES[page]!]) {
      expect(markup).not.toContain("apps.apple.com");
      expect(markup).not.toContain("itunes.apple.com");
      expect(markup).not.toContain("play.google.com");
      expect(markup.toLowerCase()).not.toContain("testflight");
    }
  });
});
