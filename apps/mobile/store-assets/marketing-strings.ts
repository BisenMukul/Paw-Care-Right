/**
 * T100 plan step 9 -- per-screenshot marketing copy blocks (plan decision
 * D9: store-listing copy, not app UI copy, so it lives here rather than in
 * `src/strings.ts` and never ships in the RN bundle). `disclosure` is
 * IMPORTED from `src/strings.ts` rather than restated, so the frozen §7
 * safety wording stays single-sourced.
 *
 * Copy rules (binding, enforced by `store-marketing-strings.test.ts`):
 * headline <= 40 chars, subhead <= 90 chars; benefit/plain-language framing
 * only; no diagnosis/dosing/cure/guarantee/clinical-claim language; the
 * "03-check-result" subhead references that every result carries the vet
 * disclaimer, and does not imply the app itself handles emergencies; the
 * "08-plus" subhead describes plan value without any medical-outcome claim.
 */
import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";

import { strings } from "../src/strings";

export interface ShotCopy {
  readonly headline: string;
  readonly subhead: string;
}

export const storeMarketing = {
  en: {
    shots: {
      "01-home": {
        headline: "Peace of mind for pet parents",
        subhead: "See your pet's care, reminders, and history in one simple home screen.",
      },
      "02-symptom-check": {
        headline: "Something seem off? Start here",
        subhead: "Answer a few quick questions about your pet's symptoms for guidance on next steps.",
      },
      "03-check-result": {
        headline: "Guidance you can act on",
        subhead: "Every result includes plain-language guidance and the vet disclaimer, front and center.",
      },
      "04-food-safety": {
        headline: "Wondering if a food is safe?",
        subhead: "Ask about foods and household items and get clear, judgment-free guidance.",
      },
      "05-reminders": {
        headline: "Never miss a vaccine again",
        subhead: "Simple reminders for vaccines, parasite prevention, grooming, and vet visits.",
      },
      "06-timeline": {
        headline: "Your pet's whole story, organized",
        subhead: "A timeline of weight, activity, and health notes you can share with any vet.",
      },
      "07-chat": {
        headline: "Ask anything, any time",
        subhead: "A calm place to ask pet-care questions and get plain-language guidance.",
      },
      "08-plus": {
        headline: "More peace of mind with Plus",
        subhead: "Unlock unlimited checks, chat, and family sharing for the whole household.",
      },
    } satisfies Record<string, ShotCopy>,
    disclosure: strings.check.result.disclaimer(APP_DISPLAY_NAME),
  },
} as const;
