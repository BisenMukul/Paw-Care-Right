import { strings } from "../strings";
import { resolveSections, type LegalDocument, type LegalSectionSource } from "./legal-document";

const SECTION_SOURCES: LegalSectionSource[] = [
  { id: "who-we-are", ...strings.legal.privacy.whoWeAre, legalReview: "company-entity" },
  { id: "what-we-collect", ...strings.legal.privacy.whatWeCollect },
  { id: "pet-health-data", ...strings.legal.privacy.petHealthData },
  { id: "ai-guidance", ...strings.legal.privacy.aiGuidance },
  { id: "how-we-use", ...strings.legal.privacy.howWeUse },
  { id: "sharing-and-processors", ...strings.legal.privacy.sharingAndProcessors, legalReview: "sub-processors" },
  { id: "retention", ...strings.legal.privacy.retention, legalReview: "retention" },
  { id: "household-sharing", ...strings.legal.privacy.householdSharing },
  { id: "your-choices", ...strings.legal.privacy.yourChoices },
  { id: "gdpr", ...strings.legal.privacy.gdpr, legalReview: "gdpr" },
  { id: "ccpa", ...strings.legal.privacy.ccpa, legalReview: "ccpa" },
  {
    id: "international-transfers",
    ...strings.legal.privacy.internationalTransfers,
    legalReview: "international-transfers",
  },
  { id: "security", ...strings.legal.privacy.security },
  { id: "children", ...strings.legal.privacy.children },
  { id: "changes", ...strings.legal.privacy.changes },
  { id: "contact", ...strings.legal.privacy.contact },
];

export function buildPrivacyDocument(appName: string): LegalDocument {
  return {
    slug: "privacy",
    title: strings.legal.privacy.title,
    effectiveDateLine: `Effective date: ${strings.legal.shared.effectiveDatePlaceholder}`,
    intro: strings.legal.privacy.intro.map((paragraph) => paragraph(appName)),
    sections: resolveSections(SECTION_SOURCES, appName),
  };
}
