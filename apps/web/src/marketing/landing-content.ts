import { toxins } from "@pawcareright/data";

import { buildAppDeepLink } from "../deep-link";
import { allFoodPagePaths } from "../food/params";
import { pageTitle } from "../food/page-model";
import { speciesBySegment, type SpeciesDescriptor } from "../food/species";
import { strings } from "../strings";

export interface LandingStep {
  id: string;
  heading: string;
  body: string;
}

export interface LandingPlan {
  id: "monthly" | "annual" | "family";
  name: string;
  price: string;
  cadence: string;
  note: string;
  highlighted: boolean;
}

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface LandingLink {
  href: string;
  label: string;
}

export interface LandingModel {
  hero: { title: string; tagline: string; body: string };
  emergencyNote: string;
  steps: LandingStep[];
  pricing: { heading: string; notice: string; plans: LandingPlan[]; freeTierNote: string };
  faq: LandingFaq[];
  getTheApp: {
    heading: string;
    body: string;
    badges: string[];
    openInAppLabel: string;
    openInAppHref: string;
    notInstalledNote: string;
  };
  popularAnswers: { heading: string; links: LandingLink[] };
}

/**
 * D6 — pinned (segment, itemId) pairs for the "popular food and toxin
 * answers" strip. Exactly 6, each must resolve to a page the dataset
 * actually generates; `buildLandingModel` throws loudly (never silently
 * drops a link) if a pair does not exist.
 */
const POPULAR_ANSWERS: ReadonlyArray<{ segment: SpeciesDescriptor["segment"]; itemId: string }> = [
  { segment: "can-dogs-eat", itemId: "grapes" },
  { segment: "can-dogs-eat", itemId: "chocolate" },
  { segment: "can-cats-eat", itemId: "chocolate" },
  { segment: "can-dogs-eat", itemId: "xylitol" },
  { segment: "can-cats-eat", itemId: "onion" },
  { segment: "can-dogs-eat", itemId: "avocado" },
];

function buildPopularAnswerLinks(): LandingLink[] {
  const validPaths = new Set(allFoodPagePaths());
  return POPULAR_ANSWERS.map(({ segment, itemId }) => {
    const href = `/${segment}/${itemId}`;
    const species = speciesBySegment(segment);
    const row = toxins.find((t) => t.id === itemId);
    if (!validPaths.has(href) || !species || !row) {
      throw new Error(
        `popular-answer pair ${segment}/${itemId} is not a page the food dataset generates`,
      );
    }
    return { href, label: pageTitle({ species, itemName: row.name }) };
  });
}

export function buildLandingModel(appName: string): LandingModel {
  return {
    hero: {
      title: appName,
      tagline: strings.landing.hero.tagline,
      body: strings.landing.hero.body(appName),
    },
    emergencyNote: strings.landing.emergencyNote,
    steps: strings.landing.steps.map((step) => ({ ...step })),
    pricing: {
      heading: strings.landing.pricing.heading,
      notice: strings.landing.pricing.notice,
      plans: strings.landing.pricing.plans.map((plan) => ({ ...plan })),
      freeTierNote: strings.landing.pricing.freeTierNote,
    },
    faq: strings.landing.faq.map((entry) => ({ ...entry })),
    getTheApp: {
      heading: strings.landing.getTheApp.heading,
      body: strings.landing.getTheApp.body(appName),
      badges: [...strings.landing.getTheApp.badges],
      openInAppLabel: strings.landing.getTheApp.openInApp,
      openInAppHref: buildAppDeepLink(),
      notInstalledNote: strings.landing.getTheApp.notInstalledNote,
    },
    popularAnswers: {
      heading: strings.landing.popularAnswers.heading,
      links: buildPopularAnswerLinks(),
    },
  };
}
