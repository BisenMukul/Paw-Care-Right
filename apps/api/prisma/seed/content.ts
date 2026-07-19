import { SAFE_FALLBACK, type TriageResult } from "@pawcareright/types";

/**
 * The single audited home for every §7-sensitive free-text string the demo
 * seed writes (CLAUDE §7 / plan "Files to create/modify" #4). Every
 * `TriageResult` below is authored to pass `triageResultSchema`/
 * `parseTriage` (re-asserted by `demo-builders.spec.ts`'s content-scan
 * test): no "diagnos(is/e)" language, empty `homeCare` on
 * `EMERGENCY_NOW`/`VET_24H`, and a `low`-confidence result never less
 * urgent than `VET_SOON`. The medication strings are record-only ("as
 * entered") — no dosage number, no drug-as-recommendation (plan Risk R5).
 */

// ---- triage results, one per urgency tier + the deterministic fallback ----

export const TRIAGE_REASSURE: TriageResult = {
  urgency: "REASSURE",
  confidence: "high",
  summary:
    "What you've described sounds like a normal, mild tummy upset that often settles on its own with rest.",
  possibleCauses: [
    {
      name: "Mild dietary upset",
      whyItFits:
        "A single episode with normal energy and no other symptoms often follows something new eaten or a quick diet change.",
    },
  ],
  redFlagsToWatch: [
    "Repeated vomiting that doesn't stop",
    "Blood in the vomit",
    "Your pet becomes weak or stops drinking water",
  ],
  homeCare: [
    "Offer small sips of water and let your pet rest",
    "Hold food for a few hours, then offer a small, bland meal",
  ],
  doNot: ["Do not give any human medication to your pet without a veterinarian's guidance."],
  vetQuestions: ["Is it safe to wait and monitor, or should we come in sooner?"],
  followUpHours: 48,
};

export const TRIAGE_MONITOR: TriageResult = {
  urgency: "MONITOR",
  confidence: "medium",
  summary:
    "The itching and skin changes you've described are worth keeping an eye on over the next couple of days.",
  possibleCauses: [
    {
      name: "Skin irritation",
      whyItFits:
        "Localized redness and scratching without other symptoms commonly points to a skin-surface irritation.",
    },
    {
      name: "Environmental allergy",
      whyItFits: "Itching that comes and goes with the season can suggest a reaction to something in the environment.",
    },
  ],
  redFlagsToWatch: ["Swelling of the face or throat", "Open sores or spreading redness", "Signs of pain when touched"],
  homeCare: ["Keep the area clean and dry", "Discourage licking or scratching where you can"],
  doNot: ["Do not apply any human creams or medications without a veterinarian's guidance."],
  vetQuestions: ["Should we book a routine visit if this hasn't improved in a few days?"],
  followUpHours: 72,
};

export const TRIAGE_VET_SOON: TriageResult = {
  urgency: "VET_SOON",
  confidence: "medium",
  summary:
    "Reduced appetite and drinking less than usual are worth having a veterinarian look at in the next day or two.",
  possibleCauses: [
    {
      name: "Reduced appetite",
      whyItFits:
        "A drop in eating and drinking alongside lower energy can have several everyday causes worth checking.",
    },
  ],
  redFlagsToWatch: [
    "Complete refusal to eat or drink for over a day",
    "Vomiting alongside not eating",
    "Noticeable weight loss",
  ],
  homeCare: ["Offer a favorite food to encourage eating", "Keep fresh water available at all times"],
  doNot: ["Do not give any human medication to your pet without a veterinarian's guidance."],
  vetQuestions: ["Could this be linked to a dental or digestive issue?"],
  followUpHours: 24,
};

export const TRIAGE_VET_24H: TriageResult = {
  urgency: "VET_24H",
  confidence: "high",
  summary: "The breathing changes you've described need a veterinarian's assessment within the next day.",
  possibleCauses: [
    {
      name: "Respiratory strain",
      whyItFits: "Faster or more effortful breathing without another explanation warrants prompt evaluation.",
    },
  ],
  redFlagsToWatch: ["Blue or pale gums", "Breathing that keeps getting harder", "Collapse or extreme weakness"],
  homeCare: [],
  doNot: ["Do not give any human medication to your pet without a veterinarian's guidance."],
  vetQuestions: ["Could this be related to airway, heart, or lung health?"],
  followUpHours: 12,
};

export const TRIAGE_EMERGENCY: TriageResult = {
  urgency: "EMERGENCY_NOW",
  confidence: "high",
  summary: "What you've described needs urgent, in-person veterinary care right now.",
  possibleCauses: [],
  redFlagsToWatch: [],
  homeCare: [],
  doNot: ["Do not wait to see if this improves on its own — go to a vet or emergency clinic now."],
  vetQuestions: [],
  followUpHours: null,
};

/** The FALLBACK-status check writes the shared safe-fallback payload verbatim. */
export const TRIAGE_FALLBACK: TriageResult = SAFE_FALLBACK;

// ---- health-log free text ----

export const NOTE_TEXTS = {
  buddyPlayful: "Buddy was extra playful in the yard this morning and finished his whole breakfast.",
  buddyGroomed: "Gave Buddy a good brushing today — coat looks shiny and healthy.",
  cleoQuiet: "Cleo has been a bit quieter than usual today but is still eating normally.",
} as const;

export const MEAL_NOTES = {
  buddyBreakfast: "Breakfast — kibble with a spoonful of wet food mixed in",
  buddyDinner: "Dinner — regular kibble, finished the bowl",
  cleoBreakfast: "Morning wet food, ate about half",
} as const;

export const VET_VISIT_CONTENT = {
  buddyAnnual: {
    reason: "Annual wellness exam",
    clinicName: "Riverside Vet Clinic",
    notes: "Overall healthy on exam; discussed continuing the current flea and tick prevention routine.",
  },
  buddyDental: {
    reason: "Dental cleaning and check-up",
    clinicName: "Riverside Vet Clinic",
    notes: "Teeth cleaned; recommended keeping up with daily brushing at home.",
  },
  cleoCheckup: {
    reason: "Routine senior check-up",
    clinicName: "Maple Street Animal Hospital",
    notes: "Bloodwork looked normal for her age; recommended a follow-up visit next year.",
  },
} as const;

export const ACTIVITY_NOTES = {
  walk: "Walk around the block",
  play: "Fetch in the backyard",
  grooming: "Brushed coat and checked paws",
} as const;

// ---- medication reminder (record-only, "as entered" — never a suggestion) ----

export const MEDICATION_TITLE = "Ear drops";
export const MEDICATION_NAME_AS_ENTERED = "Ear drops (prescribed at Riverside Vet Clinic)";
export const MEDICATION_DOSE_AS_ENTERED = "As directed by your veterinarian";
