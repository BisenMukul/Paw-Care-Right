import { ACCOUNT_DELETION_GRACE_DAYS } from "@bombaypetcompany/types";

import { strings } from "../strings";
import {
  PRIVACY_REVIEW_TOPICS,
  TERMS_REVIEW_TOPICS,
  type LegalReviewTopic,
} from "./legal-document";
import { buildPrivacyDocument } from "./privacy-document";
import { buildTermsDocument } from "./terms-document";

const APP_NAME = "Test App";

const PRIVACY_SECTION_IDS = [
  "who-we-are",
  "what-we-collect",
  "pet-health-data",
  "ai-guidance",
  "how-we-use",
  "sharing-and-processors",
  "retention",
  "household-sharing",
  "your-choices",
  "gdpr",
  "ccpa",
  "international-transfers",
  "security",
  "children",
  "changes",
  "contact",
];

const TERMS_SECTION_IDS = [
  "acceptance",
  "not-veterinary-care",
  "no-medication-guidance",
  "emergencies",
  "eligibility",
  "accounts-and-households",
  "subscriptions-and-billing",
  "acceptable-use",
  "your-content",
  "third-party-services",
  "availability-and-changes",
  "disclaimers",
  "limitation-of-liability",
  "indemnity",
  "governing-law",
  "contact",
];

describe("privacy document structure (AC2)", () => {
  const doc = buildPrivacyDocument(APP_NAME);

  it("sections are exactly the pinned ordered id list", () => {
    expect(doc.sections.map((s) => s.id)).toEqual(PRIVACY_SECTION_IDS);
    expect(new Set(doc.sections.map((s) => s.id)).size).toBe(doc.sections.length);
  });

  it("the set of LEGAL-REVIEW topics equals PRIVACY_REVIEW_TOPICS (both directions)", () => {
    const actual = new Set(
      doc.sections.map((s) => s.legalReview).filter((t): t is LegalReviewTopic => t !== undefined),
    );
    expect(actual).toEqual(new Set(PRIVACY_REVIEW_TOPICS));
  });

  it("GDPR and CCPA each get their own marked section", () => {
    const gdpr = doc.sections.find((s) => s.id === "gdpr");
    const ccpa = doc.sections.find((s) => s.id === "ccpa");
    expect(gdpr?.legalReview).toBe("gdpr");
    expect(ccpa?.legalReview).toBe("ccpa");
  });

  it("every pinned placeholder token appears inside a LEGAL-REVIEW-marked section", () => {
    const whoWeAre = doc.sections.find((s) => s.id === "who-we-are")!;
    expect(whoWeAre.legalReview).toBeDefined();
    const body = whoWeAre.paragraphs.join(" ");
    expect(body).toContain(strings.legal.shared.companyEntityPlaceholder);
    expect(body).toContain(strings.legal.shared.registeredAddressPlaceholder);
    expect(body).toContain(strings.legal.shared.effectiveDatePlaceholder);
  });

  it("no section is a stub", () => {
    for (const section of doc.sections) {
      expect(section.paragraphs.length).toBeGreaterThan(0);
      expect(section.paragraphs[0]!.length).toBeGreaterThanOrEqual(120);
    }
    const totalLength = doc.sections.reduce(
      (sum, s) => sum + s.paragraphs.reduce((a, p) => a + p.length, 0),
      0,
    );
    expect(totalLength).toBeGreaterThanOrEqual(4000);
  });

  it("the T007 placeholder copy is gone", () => {
    const serialized = JSON.stringify(doc) + JSON.stringify(strings);
    expect(serialized).not.toContain("This is a placeholder");
    expect(serialized).not.toContain("Full legal copy will be published");
  });

  it("required substantive phrases are present", () => {
    const body = doc.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(body).toContain("EXIF");
    expect(body.toLowerCase()).toContain("household");
    expect(body.toLowerCase()).toContain("we do not sell");
    expect(body.toLowerCase()).toContain("supervisory authority");
    expect(body).toContain("under 13");
    expect(body).toContain("privacy@bombaypetcompany.app");
  });

  it("H3 (re-pointed for T091, checker F3): the policy now HONESTLY describes in-app deletion in Settings, but still does not overclaim a single-tap/instant 'delete button' flow, and the contact-based route is present", () => {
    // T086's original H3 intent was "the policy must NOT claim in-app
    // deletion exists" -- that intent inverted the moment T091 shipped
    // self-serve deletion, so the old assertion (unchanged, still passing
    // "by wording luck" per the checker's review) no longer tests what its
    // name says. Re-pointed to the CURRENT honest claim: in-app deletion
    // in Settings is real (positive assertion), but the copy still never
    // overclaims a single literal "delete button" / instant / no-
    // confirmation flow (the actual UX is a two-step destructive confirm
    // behind a 30-day grace window, not one tap).
    const body = doc.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(body.toLowerCase()).toMatch(/delete your account yourself.*in settings/);
    expect(body).not.toMatch(/delete (my|your) account (button|in the app)/i);
    expect(body.toLowerCase()).not.toContain("one tap");
    expect(body.toLowerCase()).not.toContain("one-tap");
    expect(body.toLowerCase()).not.toContain("instantly delete");
    expect(body).toContain("privacy@bombaypetcompany.app");
  });

  it("T091: the privacy policy no longer says self-serve deletion is unavailable", () => {
    const body = doc.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(body).not.toContain("a self-serve in-app deletion option is planned but is not yet available");
    expect(body.toLowerCase()).not.toMatch(/deletion option is planned/);
  });

  it("T091: the retention section states the deletion grace period (imported from @bombaypetcompany/types, not hardcoded)", () => {
    const retention = doc.sections.find((s) => s.id === "retention")!;
    const body = retention.paragraphs.join(" ");
    expect(body).toContain(`${ACCOUNT_DELETION_GRACE_DAYS}-day grace window`);
    expect(body).toMatch(/signing back in.*cancels the deletion/i);
    expect(body.toLowerCase()).toContain("in settings");
  });
});

describe("terms document structure (AC2)", () => {
  const doc = buildTermsDocument(APP_NAME);

  it("sections are exactly the pinned ordered id list", () => {
    expect(doc.sections.map((s) => s.id)).toEqual(TERMS_SECTION_IDS);
    expect(new Set(doc.sections.map((s) => s.id)).size).toBe(doc.sections.length);
  });

  it("the set of LEGAL-REVIEW topics equals TERMS_REVIEW_TOPICS (both directions)", () => {
    const actual = new Set(
      doc.sections.map((s) => s.legalReview).filter((t): t is LegalReviewTopic => t !== undefined),
    );
    expect(actual).toEqual(new Set(TERMS_REVIEW_TOPICS));
  });

  it("no section is a stub", () => {
    for (const section of doc.sections) {
      expect(section.paragraphs.length).toBeGreaterThan(0);
      expect(section.paragraphs[0]!.length).toBeGreaterThanOrEqual(120);
    }
    const totalLength = doc.sections.reduce(
      (sum, s) => sum + s.paragraphs.reduce((a, p) => a + p.length, 0),
      0,
    );
    expect(totalLength).toBeGreaterThanOrEqual(3500);
  });

  it("the T007 placeholder copy is gone", () => {
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain("This is a placeholder");
    expect(serialized).not.toContain("Full legal copy will be published");
  });

  it("the not-veterinary-care clause is verbatim and is the second section", () => {
    expect(doc.sections[1]?.id).toBe("not-veterinary-care");
    expect(doc.sections[1]?.paragraphs[0]).toBe(
      `NOT VETERINARY CARE. ${APP_NAME} provides general pet-care information and guidance only. It is not veterinary care, treatment or advice, and it is not a substitute for examination by a licensed veterinarian. If your pet is unwell or injured, or you are unsure, contact a licensed veterinarian. If your pet may be in a life-threatening situation, contact your nearest emergency veterinary clinic or a pet poison helpline immediately.`,
    );
  });

  it("the no-medication clause is verbatim", () => {
    const section = doc.sections.find((s) => s.id === "no-medication-guidance");
    expect(section?.paragraphs[0]).toBe(
      `${APP_NAME} never provides medication dosages and never recommends medicines for animals. The medication tracker only records what a veterinarian has already prescribed, as entered by you. Never give an animal human medication, or any medicine, without instructions from a veterinarian.`,
    );
  });

  it("required substantive phrases are present", () => {
    const body = doc.sections.flatMap((s) => s.paragraphs).join(" ");
    expect(body).toContain("7-day");
    expect(body).toMatch(/app stores|App Store/);
    expect(body.toLowerCase()).toContain("cruelty");
    expect(body).toContain("legal@bombaypetcompany.app");
  });

  it("the governing-law placeholder appears inside its LEGAL-REVIEW-marked section", () => {
    const section = doc.sections.find((s) => s.id === "governing-law")!;
    expect(section.legalReview).toBe("jurisdiction");
    expect(section.paragraphs.join(" ")).toContain(strings.legal.shared.jurisdictionPlaceholder);
  });

  it("the acceptance section carries the company-entity, registered-address and effective-date placeholders", () => {
    const section = doc.sections.find((s) => s.id === "acceptance")!;
    expect(section.legalReview).toBe("company-entity");
    const body = section.paragraphs.join(" ");
    expect(body).toContain(strings.legal.shared.companyEntityPlaceholder);
    expect(body).toContain(strings.legal.shared.registeredAddressPlaceholder);
    expect(body).toContain(strings.legal.shared.effectiveDatePlaceholder);
  });
});

describe("shared review-notice sentence (D1)", () => {
  it("starts with the literal LEGAL-REVIEW token", () => {
    expect(strings.legal.shared.reviewNotice("Some topic")).toBe(
      "LEGAL-REVIEW — Some topic: this section is template text and must be reviewed and completed by a qualified lawyer before launch (checkpoint C3).",
    );
  });
});
