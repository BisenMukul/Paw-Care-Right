import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { REGION_HOTLINES, toxins } from "@pawcareright/data";
import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { FoodPageView } from "../components/food/food-page-view";
import { strings } from "../strings";
import { foodItemIds } from "./params";
import { buildFoodPageModel, type FoodPageModel } from "./page-model";
import { SPECIES_SEGMENTS } from "./species";

interface RenderedPage {
  segment: FoodPageModel["segment"];
  itemId: string;
  verdict: FoodPageModel["verdict"];
  model: FoodPageModel;
  markup: string;
}

// Rendered once for the whole file — ~466 renders of a small tree is fast
// (R11) and every test below reads from this single exhaustive set.
const ALL_PAGES: RenderedPage[] = SPECIES_SEGMENTS.flatMap((segment) =>
  foodItemIds().map((itemId) => {
    const model = buildFoodPageModel(segment, itemId);
    if (!model) {
      throw new Error(`buildFoodPageModel returned null for ${segment}/${itemId}`);
    }
    return {
      segment,
      itemId,
      verdict: model.verdict,
      model,
      markup: renderToStaticMarkup(<FoodPageView model={model} />),
    };
  }),
);

const TOXIC_OR_EMERGENCY = new Set(
  ALL_PAGES.filter((p) => p.verdict === "toxic" || p.verdict === "emergency").map(
    (p) => `${p.segment}/${p.itemId}`,
  ),
);

function pagesRenderingTestId(testId: string): Set<string> {
  return new Set(
    ALL_PAGES.filter((p) => p.markup.includes(`data-testid="${testId}"`)).map(
      (p) => `${p.segment}/${p.itemId}`,
    ),
  );
}

describe("render — dataset sanity (non-vacuous set-equality preconditions)", () => {
  it("all 466 pages build successfully", () => {
    expect(ALL_PAGES.length).toBe(toxins.length * SPECIES_SEGMENTS.length);
  });

  it("the dataset really contains pages of all four verdicts", () => {
    const counts: Record<FoodPageModel["verdict"], number> = {
      safe: 0,
      caution: 0,
      toxic: 0,
      emergency: 0,
    };
    for (const page of ALL_PAGES) {
      counts[page.verdict] += 1;
    }
    expect(counts.safe).toBeGreaterThan(0);
    expect(counts.caution).toBeGreaterThan(0);
    expect(counts.toxic).toBeGreaterThan(0);
    expect(counts.emergency).toBeGreaterThan(0);
  });

  it("tripwire: no human-med/household-chemical/pest-bait item is safe for either species", () => {
    const offenders = toxins.filter(
      (t) =>
        ["human-med", "household-chemical", "pest-bait"].includes(t.category) &&
        (t.verdicts.dog === "safe" || t.verdicts.cat === "safe"),
    );
    expect(offenders.map((t) => t.id)).toEqual([]);
  });
});

describe("AC3 — hotline CTA set-equality (D7 / R4)", () => {
  it("the set of pages rendering the PRE-H1 emergency CTA equals exactly the toxic∪emergency set", () => {
    const rendering = pagesRenderingTestId("emergency-hotline-cta");
    expect(rendering).toEqual(TOXIC_OR_EMERGENCY);
  });

  it("R4: the informational hotline section appears on ALL pages (count == total)", () => {
    const rendering = pagesRenderingTestId("hotline-info-section");
    expect(rendering.size).toBe(ALL_PAGES.length);
    expect(rendering.size).toBe(toxins.length * SPECIES_SEGMENTS.length);
  });

  it("every PRE-H1 CTA lists every seeded region", () => {
    const sample = ALL_PAGES.filter((p) => TOXIC_OR_EMERGENCY.has(`${p.segment}/${p.itemId}`)).slice(0, 6);
    expect(sample.length).toBe(6);
    for (const page of sample) {
      for (const hotline of REGION_HOTLINES) {
        expect(page.markup).toContain(hotline.poisonHotlineName);
        expect(page.markup).toContain(hotline.displayNumber);
      }
      const telCount = (page.markup.match(/href="tel:/g) ?? []).length;
      // Both the urgent CTA and the always-on informational section render
      // the full REGION_HOTLINES list on a toxic/emergency page (R4), so the
      // tel: count is a multiple of REGION_HOTLINES.length, never less.
      expect(telCount % REGION_HOTLINES.length).toBe(0);
      expect(telCount).toBeGreaterThanOrEqual(REGION_HOTLINES.length);
    }
  });

  it("the hotline block is rendered from the dataset, not from literals", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "..", "components", "food", "emergency-hotline-cta.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/\d{6,}/);
    expect(source).not.toMatch(/tel:["'`]?\+?\d/);
  });

  it("every hotline CTA (urgent or informational) includes the unlisted-region fallback line", () => {
    for (const page of ALL_PAGES) {
      expect(page.markup).toContain(strings.foodPage.emergency.fallback);
    }
  });

  it("the PRE-H1 CTA appears before the <h1>", () => {
    for (const page of ALL_PAGES) {
      if (!TOXIC_OR_EMERGENCY.has(`${page.segment}/${page.itemId}`)) {
        continue;
      }
      const ctaIndex = page.markup.indexOf('data-testid="emergency-hotline-cta"');
      const h1Index = page.markup.indexOf("<h1");
      expect(ctaIndex).toBeGreaterThanOrEqual(0);
      expect(h1Index).toBeGreaterThan(ctaIndex);
    }
  });

  it("toxic/emergency pages never say 'safe to eat' or 'usually fine'", () => {
    for (const page of ALL_PAGES) {
      if (page.verdict !== "toxic" && page.verdict !== "emergency") {
        continue;
      }
      expect(page.markup.toLowerCase()).not.toContain("safe to eat");
      expect(page.markup.toLowerCase()).not.toContain("usually fine");
    }
  });
});

describe("§5/§7 safety scans (over all 466 rendered pages)", () => {
  it("every page renders the non-dismissible <VetDisclaimer/>", () => {
    const disclaimerSentence = strings.disclaimer(APP_DISPLAY_NAME);
    let count = 0;
    for (const page of ALL_PAGES) {
      if (page.markup.includes('data-testid="vet-disclaimer"') && page.markup.includes(disclaimerSentence)) {
        count += 1;
      }
    }
    expect(count).toBe(ALL_PAGES.length);
  });

  it("no page markup contains an interactive dismiss affordance", () => {
    for (const page of ALL_PAGES) {
      expect(page.markup.toLowerCase()).not.toContain("<button");
      expect(page.markup.toLowerCase()).not.toContain("onclick");
      expect(page.markup).not.toContain('aria-label="Close"');
    }
  });

  it('no page markup contains "diagnos"', () => {
    const offenders: string[] = [];
    for (const page of ALL_PAGES) {
      if (/diagnos/i.test(page.markup)) {
        offenders.push(`${page.segment}/${page.itemId}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no page markup contains a dosing amount", () => {
    const NUMERIC_UNIT_DOSING_PATTERN = /\b\d+\s*(mg|ml|mcg|g|kg|iu)\b/i;
    const MG_PER_KG_PATTERN = /mg\s*\/\s*kg/i;
    const PER_BODYWEIGHT_PATTERN = /per\s+(kg|pound|lb)\b/i;
    const offenders: string[] = [];
    for (const page of ALL_PAGES) {
      if (
        NUMERIC_UNIT_DOSING_PATTERN.test(page.markup) ||
        MG_PER_KG_PATTERN.test(page.markup) ||
        PER_BODYWEIGHT_PATTERN.test(page.markup)
      ) {
        offenders.push(`${page.segment}/${page.itemId}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no page markup contains de-escalating reassurance", () => {
    const REASSURANCE_PATTERN =
      /(will be fine|do ?n[o']?t worry|nothing to worry about|(perfectly|completely|totally) safe|no need to (see|call|contact) a vet|just monitor|harmless|no vet needed)/i;
    // T085 review M12b: on the two fail-upward verdicts, softened variants
    // ("will MOST LIKELY be fine", "usually fine") are exactly the incident
    // class §5 forbids, so those pages get a stricter second pattern. Safe
    // and caution pages legitimately carry "Usually fine"/"Usually not a
    // concern" as their sanctioned (pinned) labels, so the strict pattern is
    // verdict-scoped rather than global.
    const STRICT_ESCALATION_PATTERN =
      /((will|should) (most likely |probably |usually )?be (fine|ok(ay)?)|(most likely|usually|probably|mostly|generally) ?(be )?(fine|ok(ay)?|safe)|not a concern|low concern|monitor at home)/i;
    const offenders: string[] = [];
    for (const page of ALL_PAGES) {
      if (REASSURANCE_PATTERN.test(page.markup)) {
        offenders.push(`${page.segment}/${page.itemId}`);
        continue;
      }
      const verdict = page.model.verdict;
      if (verdict === "toxic" || verdict === "emergency") {
        // Dataset prose (note/quantityNuance, VERBATIM per D2 and §7-linted at
        // its source) may legitimately describe the OTHER species — e.g.
        // permethrin is "generally safe for dogs" on the cat emergency page —
        // so the strict pattern guards only the app-owned strings around it.
        // `description` embeds a truncated note prefix (a mutated headline
        // hiding inside it is still caught via its standalone hero/FAQ
        // renderings); fields are stripped in raw AND React-escaped forms.
        const escapeHtml = (value: string): string =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;");
        const appOwnedMarkup = [page.model.note, page.model.quantityNuance, page.model.description]
          .filter((field): field is string => field !== undefined)
          .flatMap((field) => [field, escapeHtml(field)])
          .reduce((markup, field) => markup.split(field).join(""), page.markup);
        if (STRICT_ESCALATION_PATTERN.test(appOwnedMarkup)) {
          offenders.push(`${page.segment}/${page.itemId} (strict)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the pinned verdict labels and headlines carry the fail-upward wording (§5 — M12b guard)", () => {
    expect(strings.foodPage.verdictLabel).toEqual({
      safe: "Usually fine",
      caution: "Use caution",
      toxic: "Not safe",
      emergency: "Emergency",
    });
    expect(strings.foodPage.verdictHeadline.safe("dogs")).toBe("Usually not a concern for dogs");
    expect(strings.foodPage.verdictHeadline.caution("dogs")).toBe("Not recommended for dogs");
    expect(strings.foodPage.verdictHeadline.toxic("dogs")).toBe("Not safe for dogs");
    expect(strings.foodPage.verdictHeadline.emergency("dogs")).toBe(
      "Dangerous for dogs — treat this as an emergency",
    );
  });

  it("the pinned whatToDo constants contain the only sanctioned emesis wording", () => {
    expect(strings.foodPage.whatToDo.toxic).toBe(
      "Contact your vet or a pet poison helpline straight away, even if your pet seems fine. Do not wait for symptoms, do not try to treat this at home, and do not try to make your pet vomit unless a vet tells you to.",
    );
    expect(strings.foodPage.whatToDo.emergency).toBe(
      "Contact your nearest emergency vet or a pet poison helpline right now. Do not wait for symptoms, do not try to treat this at home, and do not try to make your pet vomit unless a vet tells you to.",
    );
  });

  it("no page markup contains home-treatment or emesis instructions outside the pinned whatToDo sentence", () => {
    const HOME_TREATMENT_PATTERN =
      /(induce vomiting|make (your|the) (pet|dog|cat) vomit|hydrogen peroxide|activated charcoal)/i;
    const offenders: string[] = [];
    for (const page of ALL_PAGES) {
      const withoutWhatToDo = page.markup.split(page.model.whatToDo).join("");
      if (HOME_TREATMENT_PATTERN.test(withoutWhatToDo)) {
        offenders.push(`${page.segment}/${page.itemId}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("positive control: the scanner flags a planted string (proves the scanners are live, not a no-op)", () => {
    const planted = "Give 5 mg/kg and your pet will be fine — this is a diagnosis.";
    const findings: string[] = [];
    if (/diagnos/i.test(planted)) findings.push("diagnosis");
    if (
      /\b\d+\s*(mg|ml|mcg|g|kg|iu)\b/i.test(planted) ||
      /mg\s*\/\s*kg/i.test(planted) ||
      /per\s+(kg|pound|lb)\b/i.test(planted)
    ) {
      findings.push("dosing");
    }
    if (
      /(will be fine|do ?n[o']?t worry|nothing to worry about|(perfectly|completely|totally) safe|no need to (see|call|contact) a vet|just monitor|harmless|no vet needed)/i.test(
        planted,
      )
    ) {
      findings.push("reassurance");
    }
    // M12b positive control: the strict verdict-scoped pattern must catch the
    // softened-reassurance incident class the global pattern deliberately
    // tolerates on safe pages.
    const plantedSoftened = "Usually harmless for dogs — just monitor at home.";
    if (
      /((will|should) (most likely |probably |usually )?be (fine|ok(ay)?)|(most likely|usually|probably|mostly|generally) ?(be )?(fine|ok(ay)?|safe)|not a concern|low concern|monitor at home)/i.test(
        plantedSoftened,
      )
    ) {
      findings.push("strict-escalation");
    }
    expect(findings).toEqual(["diagnosis", "dosing", "reassurance", "strict-escalation"]);
  });
});

describe("App-store honesty (§5.7)", () => {
  it("the app CTA renders the coming-soon badge on every page", () => {
    let count = 0;
    for (const page of ALL_PAGES) {
      if (
        page.markup.includes('data-testid="app-store-badge"') &&
        page.markup.includes(strings.foodPage.appCta.badge)
      ) {
        count += 1;
      }
    }
    expect(count).toBe(ALL_PAGES.length);
  });

  it("no page links to a store", () => {
    for (const page of ALL_PAGES) {
      expect(page.markup).not.toContain("apps.apple.com");
      expect(page.markup).not.toContain("itunes.apple.com");
      expect(page.markup).not.toContain("play.google.com");
      expect(page.markup.toLowerCase()).not.toContain("testflight");
    }
  });

  it("the app-store-cta section contains no <a", () => {
    for (const page of ALL_PAGES) {
      const start = page.markup.indexOf('data-testid="app-store-cta"');
      expect(start).toBeGreaterThanOrEqual(0);
      const sectionStart = page.markup.lastIndexOf("<section", start);
      const sectionEnd = page.markup.indexOf("</section>", start);
      const section = page.markup.slice(sectionStart, sectionEnd);
      expect(section).not.toContain("<a ");
      expect(section).not.toContain("<a>");
    }
  });

  it("the display name is never hardcoded in a src source file", () => {
    const srcDir = path.join(__dirname, "..");
    const offenders: string[] = [];
    // Excludes *.spec.* files, which legitimately reference this literal as
    // the comparison target for this very check.
    const FORBIDDEN_DISPLAY_NAME = ["Paw Care Right", "+"].join(" ");

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.spec\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(FORBIDDEN_DISPLAY_NAME)) {
            offenders.push(fullPath);
          }
        }
      }
    }

    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
