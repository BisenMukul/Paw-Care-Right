import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { APP_DISPLAY_NAME, DEEPLINK_SCHEME } from "@pawcareright/config";

import { LegalDocumentView } from "../components/legal/legal-document-view";
import { LandingView } from "../components/marketing/landing-view";
import { buildPrivacyDocument } from "../legal/privacy-document";
import { buildTermsDocument } from "../legal/terms-document";
import { strings } from "../strings";
import { buildLandingModel } from "./landing-content";

const landingMarkup = renderToStaticMarkup(
  <LandingView model={buildLandingModel(APP_DISPLAY_NAME)} />,
);
const privacyMarkup = renderToStaticMarkup(
  <LegalDocumentView document={buildPrivacyDocument(APP_DISPLAY_NAME)} />,
);
const termsMarkup = renderToStaticMarkup(
  <LegalDocumentView document={buildTermsDocument(APP_DISPLAY_NAME)} />,
);
const ALL_PAGES = [landingMarkup, privacyMarkup, termsMarkup];

/**
 * B7 (T088): hoisted §7 scanner patterns — the single source of truth for
 * both the production scans below and the positive control at the bottom of
 * this file, so the control can never silently drift from what production
 * actually checks. Byte-unchanged from their prior inline declarations.
 */
const DIAGNOSIS_PATTERN = /diagnos/i;
const NUMERIC_UNIT_DOSING_PATTERN = /\b\d+\s*(mg|ml|mcg|g|kg|iu)\b/i;
const MG_PER_KG_PATTERN = /mg\s*\/\s*kg/i;
const PER_BODYWEIGHT_PATTERN = /per\s+(kg|pound|lb)\b/i;
const VET_EQUIVALENCE_PATTERN =
  /(replaces? (your |a )?vet|instead of (a |your )?vet|no need to (see|call|contact) a vet|virtual vet|online vet|we treat|\bprescribe\b)/i;

describe("all three pages render the non-dismissible <VetDisclaimer/>", () => {
  it("3/3 pages carry the disclaimer testid and exact sentence", () => {
    const disclaimerSentence = strings.disclaimer(APP_DISPLAY_NAME);
    let count = 0;
    for (const markup of ALL_PAGES) {
      if (markup.includes('data-testid="vet-disclaimer"') && markup.includes(disclaimerSentence)) {
        count += 1;
      }
    }
    expect(count).toBe(3);
  });
});

describe("no page markup contains an interactive dismiss affordance", () => {
  it("no <button, no onclick, no aria-label=Close", () => {
    for (const markup of ALL_PAGES) {
      expect(markup.toLowerCase()).not.toContain("<button");
      expect(markup.toLowerCase()).not.toContain("onclick");
      expect(markup).not.toContain('aria-label="Close"');
    }
  });
});

describe("§7.1 no diagnos*", () => {
  it("no page markup contains 'diagnos'", () => {
    for (const markup of ALL_PAGES) {
      expect(DIAGNOSIS_PATTERN.test(markup)).toBe(false);
    }
  });
});

describe("§5.4/§7.2 no dosing amounts", () => {
  it("no page markup contains a dosing pattern", () => {
    for (const markup of ALL_PAGES) {
      expect(NUMERIC_UNIT_DOSING_PATTERN.test(markup)).toBe(false);
      expect(MG_PER_KG_PATTERN.test(markup)).toBe(false);
      expect(PER_BODYWEIGHT_PATTERN.test(markup)).toBe(false);
    }
  });
});

describe("no vet-equivalence or treatment claims", () => {
  it("no page markup claims vet equivalence or treatment", () => {
    // Word-boundary on `prescribe` (matches only the standalone verb, e.g.
    // "we prescribe", never the compliant past tense "already prescribed"
    // that the pinned no-medication-guidance clause requires, per CLAUDE
    // §7.2 — the med tracker legitimately records what a vet prescribed).
    for (const markup of ALL_PAGES) {
      expect(VET_EQUIVALENCE_PATTERN.test(markup)).toBe(false);
    }
  });
});

describe("landing emergency note ordering (§5 fail-upward)", () => {
  it("the emergency note appears before the pricing and FAQ sections", () => {
    const noteIndex = landingMarkup.indexOf('data-testid="landing-emergency-note"');
    const pricingIndex = landingMarkup.indexOf('id="pricing"');
    const faqIndex = landingMarkup.indexOf('id="faq"');
    expect(noteIndex).toBeGreaterThanOrEqual(0);
    expect(pricingIndex).toBeGreaterThan(noteIndex);
    expect(faqIndex).toBeGreaterThan(noteIndex);
  });

  it("the landing section ids are exactly the pinned ordered list", () => {
    const ids = ["hero", "how-it-works", "pricing", "faq", "get-the-app", "popular-answers"];
    let lastIndex = -1;
    for (const id of ids) {
      const index = landingMarkup.indexOf(`id="${id}"`);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
    // No extra <section id=...> beyond the pinned six.
    const matches = landingMarkup.match(/<section id="[^"]+"/g) ?? [];
    expect(matches).toHaveLength(ids.length);
  });
});

describe("pricing section has no purchase affordance (§5.7/D7)", () => {
  it("the pricing section contains no <a and no <button", () => {
    const start = landingMarkup.indexOf('id="pricing"');
    const end = landingMarkup.indexOf('id="faq"');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const section = landingMarkup.slice(start, end);
    expect(section).not.toContain("<a ");
    expect(section).not.toContain("<button");
  });
});

describe("get-the-app badges are non-linking (§5.7)", () => {
  it("the badges are spans; the only anchor in that section is the deep link", () => {
    const start = landingMarkup.indexOf('id="get-the-app"');
    const end = landingMarkup.indexOf('id="popular-answers"');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const section = landingMarkup.slice(start, end);
    const anchors = section.match(/<a\s[^>]*>/g) ?? [];
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toContain(`href="${DEEPLINK_SCHEME}://"`);
    const badgeSpans = section.match(/<span[^>]*>[^<]*<\/span>/g) ?? [];
    expect(badgeSpans).toHaveLength(2);
    for (const badge of badgeSpans) {
      expect(badge).not.toContain("<a");
    }
  });
});

describe("no hardcoded display name or deep-link scheme (§1a)", () => {
  it("no non-spec src/app .ts/.tsx contains the literal display name; only deep-link.ts contains the scheme literal", () => {
    const webRoot = path.join(__dirname, "..", "..");
    const srcDir = path.join(webRoot, "src");
    const appDir = path.join(webRoot, "app");
    const FORBIDDEN_DISPLAY_NAME = ["Paw Care Right", "+"].join(" ");
    const SCHEME_URL = `${DEEPLINK_SCHEME}://`;
    const deepLinkFile = path.join(srcDir, "deep-link.ts");
    // Matches a bare quoted "pawcareright" token — NOT the substring inside
    // the legitimate `"@pawcareright/config"` package specifier, because
    // there a quote character never sits directly next to "pawcareright"
    // (it's preceded by "@" and followed by "/config").
    const BARE_SCHEME_LITERAL = /["'`]pawcareright["'`]/;

    const displayNameOffenders: string[] = [];
    const schemeOffenders: string[] = [];

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".next") continue;
          walk(fullPath);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.spec\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(FORBIDDEN_DISPLAY_NAME)) {
            displayNameOffenders.push(fullPath);
          }
          if (fullPath === deepLinkFile) {
            if (BARE_SCHEME_LITERAL.test(content)) {
              schemeOffenders.push(`${fullPath} (must derive from the DEEPLINK_SCHEME import, not a literal)`);
            }
          } else if (content.includes(SCHEME_URL)) {
            schemeOffenders.push(fullPath);
          }
        }
      }
    }

    walk(srcDir);
    walk(appDir);
    expect(displayNameOffenders).toEqual([]);
    expect(schemeOffenders).toEqual([]);
  });
});

describe("positive control (proves the scanners are live, not a no-op)", () => {
  it("the diagnosis / dosing / vet-equivalence scanners flag a planted string", () => {
    const planted = "Give 5 mg/kg — this online vet replaces your vet and gives you a diagnosis.";
    const findings: string[] = [];
    if (DIAGNOSIS_PATTERN.test(planted)) findings.push("diagnosis");
    if (
      NUMERIC_UNIT_DOSING_PATTERN.test(planted) ||
      MG_PER_KG_PATTERN.test(planted) ||
      PER_BODYWEIGHT_PATTERN.test(planted)
    ) {
      findings.push("dosing");
    }
    if (VET_EQUIVALENCE_PATTERN.test(planted)) {
      findings.push("vet-equivalence");
    }
    expect(findings).toEqual(["diagnosis", "dosing", "vet-equivalence"]);
  });

  it("the vet-equivalence scanner's `prescribe` boundary distinguishes the sanctioned past tense", () => {
    expect(VET_EQUIVALENCE_PATTERN.test("We prescribe the right medicine for them.")).toBe(true);
    expect(VET_EQUIVALENCE_PATTERN.test("records what a veterinarian has already prescribed")).toBe(false);
  });
});
