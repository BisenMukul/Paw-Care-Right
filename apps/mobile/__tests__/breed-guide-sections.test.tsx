import { getBreedGuide, VET_PROMPT_PREFIX, type BreedGuide } from "@bombaypetcompany/data";
import { render, screen } from "@testing-library/react-native";

import { BreedGuideSections } from "../src/components/breed-guide-sections";
import { VetDisclaimer } from "../src/components/vet-disclaimer";
import { strings } from "../src/strings";

/**
 * T087 plan (AC1/AC3) — the §7-critical renderer. Every assertion here
 * checks against the REAL dataset guide (`getBreedGuide("DOG",
 * "labrador-retriever")`), never a hand-typed literal, so the "verbatim"
 * claim is genuinely tested against T084's content.
 */
const LABRADOR = getBreedGuide("DOG", "labrador-retriever");
if (LABRADOR === undefined) {
  throw new Error("test fixture assumption broken: DOG/labrador-retriever is no longer a published guide");
}

// A draft-shaped guide with no recorded reviewer/date (schema invariant:
// `reviewed: false` <=> provenance.reviewedBy/reviewedAt both absent) — used
// only to prove the provenance line is absent when the data does not record
// a review (honesty rule, plan step 5).
const UNREVIEWED_FIXTURE: BreedGuide = {
  slug: "fixture-breed",
  species: "DOG",
  temperament: "A calm, adaptable companion that settles well into most households given enough exercise.",
  exerciseNeeds: { level: "MODERATE", narrative: "Needs a couple of decent walks a day plus some playtime." },
  commonConditionAwareness: [
    { topic: "Weight", prompt: `${VET_PROMPT_PREFIX}a healthy weight range for this pet.` },
    { topic: "Teeth", prompt: `${VET_PROMPT_PREFIX}a dental care routine for this pet.` },
  ],
  groomingCadence: { frequency: "WEEKLY", narrative: "A weekly brush keeps the coat in good condition." },
  reviewed: false,
  provenance: { generatedBy: "TEMPLATE" },
};

const SECTION_TESTIDS = [
  { testID: "breed-guide-section-temperament", title: strings.breedGuide.sections.temperament },
  { testID: "breed-guide-section-exercise", title: strings.breedGuide.sections.exercise },
  { testID: "breed-guide-section-conditions", title: strings.breedGuide.sections.conditions },
  { testID: "breed-guide-section-grooming", title: strings.breedGuide.sections.grooming },
];

describe("BreedGuideSections: renders every section of a published exemplar", () => {
  it("all four section testIDs are present with the dataset's own narrative text", async () => {
    await render(<BreedGuideSections guide={LABRADOR} />);

    for (const { testID } of SECTION_TESTIDS) {
      expect(screen.getByTestId(testID)).toBeTruthy();
    }
    expect(screen.getByTestId("breed-guide-section-temperament")).toHaveTextContent(LABRADOR.temperament, {
      exact: false,
    });
    expect(screen.getByTestId("breed-guide-section-exercise")).toHaveTextContent(LABRADOR.exerciseNeeds.narrative, {
      exact: false,
    });
    expect(screen.getByTestId("breed-guide-section-grooming")).toHaveTextContent(LABRADOR.groomingCadence.narrative, {
      exact: false,
    });
  });
});

describe("BreedGuideSections: condition-awareness prompts render verbatim", () => {
  it("renders one row per awareness item, prompts verbatim", async () => {
    await render(<BreedGuideSections guide={LABRADOR} />);

    LABRADOR.commonConditionAwareness.forEach((item, index) => {
      const row = screen.getByTestId(`breed-guide-condition-${index}`);
      expect(row).toHaveTextContent(item.prompt, { exact: false });
      expect(item.prompt.startsWith(VET_PROMPT_PREFIX)).toBe(true);
    });
  });
});

describe("BreedGuideSections: provenance", () => {
  it("shows the dataset reviewer and date", async () => {
    await render(<BreedGuideSections guide={LABRADOR} />);

    const provenance = screen.getByTestId("breed-guide-provenance");
    expect(LABRADOR.provenance.reviewedBy).toBeDefined();
    expect(LABRADOR.provenance.reviewedAt).toBeDefined();
    expect(provenance).toHaveTextContent(LABRADOR.provenance.reviewedBy as string, { exact: false });
    expect(provenance).toHaveTextContent(LABRADOR.provenance.reviewedAt as string, { exact: false });
  });

  it("is absent when the dataset does not record a reviewer/date", async () => {
    await render(<BreedGuideSections guide={UNREVIEWED_FIXTURE} />);

    expect(screen.queryByTestId("breed-guide-provenance")).toBeNull();
  });
});

describe("BreedGuideSections: a11y", () => {
  it("every section title is a header and every section is labeled", async () => {
    await render(<BreedGuideSections guide={LABRADOR} />);

    for (const { testID, title } of SECTION_TESTIDS) {
      const container = screen.getByTestId(testID);
      expect(typeof container.props.accessibilityLabel).toBe("string");
      expect(container.props.accessibilityLabel.length).toBeGreaterThan(0);
      expect(container.props.accessibilityLabel).toContain(title);

      const titleNode = screen.getByText(title);
      expect(titleNode.props.accessibilityRole).toBe("header");
    }
  });

  it("headings cap dynamic type consistently", async () => {
    await render(<BreedGuideSections guide={LABRADOR} />);

    for (const { title } of SECTION_TESTIDS) {
      const titleNode = screen.getByText(title);
      expect(titleNode.props.maxFontSizeMultiplier).toBe(1.5);
    }
  });
});

describe("BreedGuideSections + VetDisclaimer: §7-critical snapshot", () => {
  it("condition-awareness section + disclaimer", async () => {
    const { toJSON } = await render(
      <>
        <BreedGuideSections guide={LABRADOR} />
        <VetDisclaimer />
      </>,
    );

    expect(toJSON()).toMatchSnapshot();
  });
});
