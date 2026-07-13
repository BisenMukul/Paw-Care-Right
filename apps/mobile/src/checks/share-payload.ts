import type { TriageResult } from "@pawcareright/types";

import { strings } from "../strings";

/**
 * Pure share-text builder (T048 plan D9). Always appends the disclaimer
 * line as the last block, regardless of which sections are present, so
 * every shared payload carries the vet-consult reminder (§5 rule 1).
 */
export function buildSharePayload(input: {
  tierLabel: string;
  result: TriageResult;
  disclaimerLine: string;
}): string {
  const s = strings.check.result.sections;
  const blocks: string[] = [input.tierLabel, input.result.summary];

  if (input.result.possibleCauses.length) {
    blocks.push(
      [s.possibleCauses, ...input.result.possibleCauses.map((c) => `- ${c.name}: ${c.whyItFits}`)].join("\n"),
    );
  }
  if (input.result.redFlagsToWatch.length) {
    blocks.push([s.redFlagsToWatch, ...input.result.redFlagsToWatch.map((x) => `- ${x}`)].join("\n"));
  }
  if (input.result.homeCare.length) {
    blocks.push([s.homeCare, ...input.result.homeCare.map((x) => `- ${x}`)].join("\n"));
  }
  if (input.result.doNot.length) {
    blocks.push([s.doNot, ...input.result.doNot.map((x) => `- ${x}`)].join("\n"));
  }
  if (input.result.vetQuestions.length) {
    blocks.push([s.vetQuestions, ...input.result.vetQuestions.map((x) => `- ${x}`)].join("\n"));
  }

  blocks.push(input.disclaimerLine);
  return blocks.join("\n\n");
}
