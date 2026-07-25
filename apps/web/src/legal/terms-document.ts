import { strings } from "../strings";
import { resolveSections, type LegalDocument, type LegalSectionSource } from "./legal-document";

const SECTION_SOURCES: LegalSectionSource[] = [
  { id: "acceptance", ...strings.legal.terms.acceptance, legalReview: "company-entity" },
  { id: "not-veterinary-care", ...strings.legal.terms.notVeterinaryCare },
  { id: "no-medication-guidance", ...strings.legal.terms.noMedicationGuidance },
  { id: "emergencies", ...strings.legal.terms.emergencies },
  { id: "eligibility", ...strings.legal.terms.eligibility },
  { id: "accounts-and-households", ...strings.legal.terms.accountsAndHouseholds },
  {
    id: "subscriptions-and-billing",
    ...strings.legal.terms.subscriptionsAndBilling,
    legalReview: "subscription-terms",
  },
  { id: "acceptable-use", ...strings.legal.terms.acceptableUse },
  { id: "your-content", ...strings.legal.terms.yourContent },
  { id: "third-party-services", ...strings.legal.terms.thirdPartyServices },
  { id: "availability-and-changes", ...strings.legal.terms.availabilityAndChanges },
  { id: "disclaimers", ...strings.legal.terms.disclaimers, legalReview: "disclaimers" },
  { id: "limitation-of-liability", ...strings.legal.terms.limitationOfLiability, legalReview: "liability" },
  { id: "indemnity", ...strings.legal.terms.indemnity },
  { id: "governing-law", ...strings.legal.terms.governingLaw, legalReview: "jurisdiction" },
  { id: "contact", ...strings.legal.terms.contact },
];

export function buildTermsDocument(appName: string): LegalDocument {
  return {
    slug: "terms",
    title: strings.legal.terms.title,
    effectiveDateLine: `Effective date: ${strings.legal.shared.effectiveDatePlaceholder}`,
    intro: strings.legal.terms.intro.map((paragraph) => paragraph(appName)),
    sections: resolveSections(SECTION_SOURCES, appName),
  };
}
