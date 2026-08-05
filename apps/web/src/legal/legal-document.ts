// Shared types + the D1 review-marker mechanism for the legal documents
// (privacy, terms). Structure (section order, ids, which sections carry a
// LEGAL-REVIEW marker) lives here and in the two per-document builders;
// prose content lives in `../strings.ts` (CLAUDE §6).

/** The literal token every visible review banner starts with (D1). */
export const LEGAL_REVIEW_MARKER = "LEGAL-REVIEW";

export type LegalReviewTopic =
  | "company-entity"
  | "sub-processors"
  | "retention"
  | "gdpr"
  | "ccpa"
  | "international-transfers"
  | "subscription-terms"
  | "disclaimers"
  | "liability"
  | "jurisdiction";

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  legalReview?: LegalReviewTopic;
}

export interface LegalDocument {
  slug: "privacy" | "terms";
  title: string;
  effectiveDateLine: string;
  intro: string[];
  sections: LegalSection[];
}

/** Topics that must carry the LEGAL-REVIEW marker on the privacy document. */
export const PRIVACY_REVIEW_TOPICS: readonly LegalReviewTopic[] = [
  "company-entity",
  "sub-processors",
  "retention",
  "gdpr",
  "ccpa",
  "international-transfers",
];

/** Topics that must carry the LEGAL-REVIEW marker on the terms document. */
export const TERMS_REVIEW_TOPICS: readonly LegalReviewTopic[] = [
  "company-entity",
  "subscription-terms",
  "disclaimers",
  "liability",
  "jurisdiction",
];

/** A raw section source: a heading plus one or more `(appName) => string` paragraph templates. */
export interface LegalSectionSource {
  id: string;
  heading: string;
  paragraphs: ReadonlyArray<(appName: string) => string>;
  bullets?: readonly string[];
  legalReview?: LegalReviewTopic;
}

/** Resolves a list of section sources into rendered `LegalSection`s for a given app name. */
export function resolveSections(sources: LegalSectionSource[], appName: string): LegalSection[] {
  return sources.map((source) => {
    const section: LegalSection = {
      id: source.id,
      heading: source.heading,
      paragraphs: source.paragraphs.map((paragraph) => paragraph(appName)),
    };
    if (source.bullets) {
      section.bullets = [...source.bullets];
    }
    if (source.legalReview) {
      section.legalReview = source.legalReview;
    }
    return section;
  });
}
