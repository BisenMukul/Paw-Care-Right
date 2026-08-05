import { DEEPLINK_SCHEME } from "@bombaypetcompany/config";

import { allFoodPagePaths } from "../food/params";
import { buildAppDeepLink, APP_URL_SCHEME } from "../deep-link";
import { buildLandingModel } from "./landing-content";

const APP_NAME = "Test App";

describe("buildLandingModel", () => {
  const model = buildLandingModel(APP_NAME);

  it("carries every section the card requires, all non-empty", () => {
    expect(model.hero.title).toBe(APP_NAME);
    expect(model.hero.tagline.length).toBeGreaterThan(0);
    expect(model.hero.body.length).toBeGreaterThan(0);
    expect(model.emergencyNote.length).toBeGreaterThan(0);
    expect(model.steps).toHaveLength(3);
    for (const step of model.steps) {
      expect(step.heading.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
    expect(model.pricing.plans).toHaveLength(3);
    expect(model.faq).toHaveLength(6);
    for (const entry of model.faq) {
      expect(entry.question.length).toBeGreaterThan(0);
      expect(entry.answer.length).toBeGreaterThan(0);
    }
    expect(model.getTheApp.badges).toHaveLength(2);
  });

  it("pricing matches PRODUCT_SPEC §7", () => {
    const byId = Object.fromEntries(model.pricing.plans.map((p) => [p.id, p]));
    expect(byId.monthly?.price).toBe("$5.99");
    expect(byId.annual?.price).toBe("$39.99");
    expect(byId.family?.price).toBe("$59.99");
    const highlighted = model.pricing.plans.filter((p) => p.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]?.id).toBe("annual");
  });

  it("the trial note says 7-day", () => {
    // Structural pricing copy (parallel to `strings.foodPage.noteHeading`
    // precedent — headings/notes read directly from `strings`, not the model).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { strings } = require("../strings") as typeof import("../strings");
    expect(strings.landing.pricing.trialNote).toContain("7-day");
  });

  it("the planned-pricing honesty notice is present verbatim (D7)", () => {
    expect(model.pricing.notice).toBe(
      "These are our planned launch prices in US dollars. Nothing is on sale yet — subscriptions open when the app launches, and prices differ by country.",
    );
  });

  it("the free-tier note matches SPEC §4 F8 limits", () => {
    expect(model.pricing.freeTierNote).toContain("one pet");
    expect(model.pricing.freeTierNote).toContain("one symptom check");
    expect(model.pricing.freeTierNote).toContain("five food and toxin lookups");
  });

  it("the deep link is built from DEEPLINK_SCHEME", () => {
    expect(model.getTheApp.openInAppHref).toBe(`${DEEPLINK_SCHEME}://`);
    expect(model.getTheApp.openInAppHref).toBe(APP_URL_SCHEME);
    expect(model.getTheApp.notInstalledNote.length).toBeGreaterThan(0);
  });

  it("the popular-answers strip has exactly 6 distinct links, all real food pages", () => {
    const valid = new Set(allFoodPagePaths());
    expect(model.popularAnswers.links).toHaveLength(6);
    const hrefs = model.popularAnswers.links.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(6);
    for (const href of hrefs) {
      expect(valid.has(href)).toBe(true);
    }
  });
});

describe("buildAppDeepLink", () => {
  it("normalises paths", () => {
    expect(buildAppDeepLink()).toBe(`${DEEPLINK_SCHEME}://`);
    expect(buildAppDeepLink("")).toBe(`${DEEPLINK_SCHEME}://`);
    expect(buildAppDeepLink("join/ABC")).toBe(`${DEEPLINK_SCHEME}://join/ABC`);
    expect(buildAppDeepLink("/join/ABC")).toBe(`${DEEPLINK_SCHEME}://join/ABC`);
  });
});

describe("buildLandingModel throws on a bad popular-answer pair (never silently drops a link)", () => {
  it("throws when a pinned pair's item id is not in the dataset", () => {
    jest.resetModules();
    jest.doMock("@bombaypetcompany/data", () => {
      const actual = jest.requireActual("@bombaypetcompany/data") as Record<string, unknown>;
      return { ...actual, toxins: [] };
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { buildLandingModel: rebuiltModel } = require("./landing-content") as typeof import("./landing-content");
    expect(() => rebuiltModel(APP_NAME)).toThrow(/not a page the food dataset generates/);
    jest.dontMock("@bombaypetcompany/data");
    jest.resetModules();
  });
});
