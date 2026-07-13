import { APP_DISPLAY_NAME } from "@pawcareright/config";
import type { TriageResult } from "@pawcareright/types";

import { buildSharePayload } from "../src/checks/share-payload";
import { strings } from "../src/strings";

const DISCLAIMER_LINE = strings.check.result.disclaimer(APP_DISPLAY_NAME);

const FIXTURE: TriageResult = {
  urgency: "VET_SOON",
  confidence: "high",
  summary: "General guidance based on the information provided.",
  possibleCauses: [{ name: "Mild upset stomach", whyItFits: "Reported symptoms are consistent with this." }],
  redFlagsToWatch: ["Repeated vomiting"],
  homeCare: ["Offer small amounts of water"],
  doNot: ["Do not give human medications without veterinary guidance."],
  vetQuestions: ["How long have symptoms been present?"],
  followUpHours: 24,
};

const EMPTY_FIXTURE: TriageResult = {
  ...FIXTURE,
  possibleCauses: [],
  redFlagsToWatch: [],
  homeCare: [],
  doNot: [],
  vetQuestions: [],
};

// T048 plan AC3 "share payload includes disclaimer line" — the disclaimer is
// ALWAYS the last block, and empty sections are omitted entirely.
describe("buildSharePayload", () => {
  it("includes the tier label, summary, a cause row, and the redFlagsToWatch heading", () => {
    const payload = buildSharePayload({
      tierLabel: "See a vet soon",
      result: FIXTURE,
      disclaimerLine: DISCLAIMER_LINE,
    });

    expect(payload).toContain("See a vet soon");
    expect(payload).toContain(FIXTURE.summary);
    expect(payload).toContain("- Mild upset stomach: Reported symptoms are consistent with this.");
    expect(payload).toContain(strings.check.result.sections.redFlagsToWatch);
    expect(payload).toContain(DISCLAIMER_LINE);
  });

  it("always ends with the disclaimer line", () => {
    const payload = buildSharePayload({
      tierLabel: "See a vet soon",
      result: FIXTURE,
      disclaimerLine: DISCLAIMER_LINE,
    });

    expect(payload.endsWith(DISCLAIMER_LINE)).toBe(true);
  });

  it("omits empty section headings and yields only tier label + summary + disclaimer", () => {
    const payload = buildSharePayload({
      tierLabel: "See a vet soon",
      result: EMPTY_FIXTURE,
      disclaimerLine: DISCLAIMER_LINE,
    });

    expect(payload).toBe(["See a vet soon", EMPTY_FIXTURE.summary, DISCLAIMER_LINE].join("\n\n"));
    expect(payload).not.toContain(strings.check.result.sections.possibleCauses);
    expect(payload).not.toContain(strings.check.result.sections.redFlagsToWatch);
    expect(payload).not.toContain(strings.check.result.sections.homeCare);
    expect(payload).not.toContain(strings.check.result.sections.doNot);
    expect(payload).not.toContain(strings.check.result.sections.vetQuestions);
  });
});
