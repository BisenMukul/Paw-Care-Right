import type { TextMessage } from "../providers/types";

import type { TriageExemplar } from "./types";

/**
 * Few-shot exemplars teaching the safe output style (T033 — the primary
 * PRODUCT_SPEC §5 surface of Phase 3). Transcribed verbatim from the plan's
 * Exemplar inventory. Every output below must pass `parseTriage` and be free
 * of diagnosis/dosing language — self-validated in `exemplars.spec.ts`.
 *
 * Coverage: all 5 tiers, both species, two low-confidence -> VET_SOON-floor
 * cases (E5, E8), one insufficient-info case (E8), cat caution demonstrated
 * (E2, E5, E7).
 */
export const TRIAGE_EXEMPLARS: readonly TriageExemplar[] = [
  {
    id: "dog-emergency-bloat",
    species: "DOG",
    tier: "EMERGENCY_NOW",
    userText:
      "My large-breed dog has been retching without bringing anything up and his belly looks swollen. He's restless and won't settle.",
    output: {
      urgency: "EMERGENCY_NOW",
      confidence: "high",
      summary:
        "A large dog with unproductive retching and a swelling belly can be a life-threatening emergency. Go to an emergency vet right now.",
      possibleCauses: [
        {
          name: "Bloat (gastric dilatation)",
          whyItFits: "Unproductive retching with a firm, distended belly in a large-breed dog fits this pattern.",
        },
      ],
      redFlagsToWatch: ["Collapse or pale gums", "Belly getting larger or harder"],
      homeCare: [],
      doNot: ["Do not wait to see if it passes", "Do not offer food or water"],
      vetQuestions: ["Does my dog need emergency surgery?", "Could this be a twisted stomach?"],
      followUpHours: null,
    },
  },
  {
    id: "cat-emergency-urinary",
    species: "CAT",
    tier: "EMERGENCY_NOW",
    userText:
      "My male cat keeps going to the litter box and straining, but only a little urine comes out. He's crying while he tries.",
    output: {
      urgency: "EMERGENCY_NOW",
      confidence: "high",
      summary:
        "A male cat straining to urinate with little or no output can be a life-threatening blockage. Seek emergency care immediately.",
      possibleCauses: [
        {
          name: "Urinary blockage",
          whyItFits: "A male cat straining with almost no urine produced strongly fits a urethral obstruction.",
        },
      ],
      redFlagsToWatch: ["Crying in the litter box", "Vomiting or collapse", "Hard, painful belly"],
      homeCare: [],
      doNot: ["Do not wait overnight", "Do not withhold water"],
      vetQuestions: ["Is my cat's bladder blocked?", "Does he need to be unblocked today?"],
      followUpHours: null,
    },
  },
  {
    id: "dog-vet24h-bloody-diarrhea",
    species: "DOG",
    tier: "VET_24H",
    userText: "My dog has had repeated watery diarrhea with streaks of blood, and he seems low on energy.",
    output: {
      urgency: "VET_24H",
      confidence: "medium",
      summary: "Repeated bloody diarrhea with low energy should be seen by a vet within a day.",
      possibleCauses: [
        {
          name: "Gut infection or inflammation",
          whyItFits: "Frequent watery stool with blood and reduced energy fits an irritated or infected gut.",
        },
        {
          name: "Dietary upset",
          whyItFits: "A sudden diet change or scavenging can trigger bloody diarrhea.",
        },
      ],
      redFlagsToWatch: ["Vomiting that won't stop", "Pale gums", "Weakness or collapse"],
      homeCare: [],
      doNot: ["Do not give any human medications", "Do not withhold water"],
      vetQuestions: ["Does my dog need fluids or tests?", "Could this be an infection?"],
      followUpHours: 24,
    },
  },
  {
    id: "dog-vetsoon-limp",
    species: "DOG",
    tier: "VET_SOON",
    userText: "My dog has been limping for a few days, puts some weight on the leg, and seems mildly painful.",
    output: {
      urgency: "VET_SOON",
      confidence: "medium",
      summary: "A limp lasting a few days with mild pain should be checked by a vet soon.",
      possibleCauses: [
        {
          name: "Soft-tissue strain",
          whyItFits: "Gradual limping with partial weight-bearing often follows a sprain or strain.",
        },
        {
          name: "Joint irritation",
          whyItFits: "Ongoing lameness can come from an irritated joint.",
        },
      ],
      redFlagsToWatch: ["Leg cannot bear any weight", "Swelling or an open wound", "Crying in pain"],
      homeCare: ["Limit running and jumping for now", "Offer rest on a soft, flat surface"],
      doNot: ["Do not give any human pain medications", "Do not massage a painful leg"],
      vetQuestions: ["Does my dog need an X-ray?", "Is this a sprain or something more?"],
      followUpHours: 72,
    },
  },
  {
    id: "cat-vetsoon-lowconf-appetite",
    species: "CAT",
    tier: "VET_SOON",
    userText: "My cat hasn't eaten much for about a day. I don't have much other detail to share.",
    output: {
      urgency: "VET_SOON",
      confidence: "low",
      summary: "With limited information and a cat that isn't eating, it is safest to have a vet check soon.",
      possibleCauses: [],
      redFlagsToWatch: ["Not eating for more than a day", "Hiding or weakness", "Vomiting"],
      homeCare: ["Offer a small amount of a favorite food", "Keep fresh water easy to reach"],
      doNot: ["Do not force-feed", "Do not give any human medications"],
      vetQuestions: ["Why might my cat have stopped eating?", "Does she need blood tests?"],
      followUpHours: 24,
    },
  },
  {
    id: "dog-monitor-single-vomit",
    species: "DOG",
    tier: "MONITOR",
    userText: "My dog vomited once but is otherwise bright, eating normally, and playing.",
    output: {
      urgency: "MONITOR",
      confidence: "medium",
      summary: "A single vomit in an otherwise bright, playful dog can usually be watched at home for now.",
      possibleCauses: [
        {
          name: "Mild stomach upset",
          whyItFits: "One episode of vomiting with normal energy and appetite usually means minor irritation.",
        },
      ],
      redFlagsToWatch: ["More vomiting", "Refusing food or water", "Low energy or a painful belly"],
      homeCare: ["Offer a small, plain meal after a short rest", "Keep water available"],
      doNot: ["Do not give any human medications", "Do not offer fatty or rich foods"],
      vetQuestions: ["When should I be concerned if it happens again?"],
      followUpHours: 24,
    },
  },
  {
    id: "cat-reassure-mild-itch",
    species: "CAT",
    tier: "REASSURE",
    userText: "My cat scratches occasionally at one spot but is bright and comfortable otherwise.",
    output: {
      urgency: "REASSURE",
      confidence: "high",
      summary: "Occasional mild scratching in a bright, comfortable cat is usually nothing to worry about.",
      possibleCauses: [
        {
          name: "Minor skin irritation",
          whyItFits: "Light, occasional scratching in one spot with no other signs points to minor irritation.",
        },
      ],
      redFlagsToWatch: ["Hair loss or sores", "Constant scratching", "Changes in appetite or energy"],
      homeCare: ["Keep the area clean and dry", "Watch for any new spots"],
      doNot: ["Do not apply any human creams or medications"],
      vetQuestions: ["Which flea-prevention option suits my cat?"],
      followUpHours: null,
    },
  },
  {
    id: "dog-vetsoon-insufficient-info",
    species: "DOG",
    tier: "VET_SOON",
    userText: "Something seems off with my dog but I'm not sure what — it's vague and I don't have much detail.",
    output: {
      urgency: "VET_SOON",
      confidence: "low",
      summary: "There isn't enough detail here to assess safely, so a vet check is the safest next step.",
      possibleCauses: [],
      redFlagsToWatch: ["Any trouble breathing", "Collapse or extreme weakness", "Repeated vomiting or bleeding"],
      homeCare: [],
      doNot: ["Do not give any human medications"],
      vetQuestions: ["What information should I bring to the vet?"],
      followUpHours: 24,
    },
  },
];

/**
 * Few-shot messages derived from `TRIAGE_EXEMPLARS`: a user turn (the
 * exemplar's `userText`) followed by the assistant's serialized JSON output,
 * for each exemplar in order (plan R8 — exemplars are prewritten fixtures,
 * not re-serialized from `buildUserTurn`).
 */
export const EXEMPLAR_MESSAGES: readonly TextMessage[] = TRIAGE_EXEMPLARS.flatMap((exemplar) => [
  { role: "user", content: exemplar.userText },
  { role: "assistant", content: JSON.stringify(exemplar.output) },
]);
