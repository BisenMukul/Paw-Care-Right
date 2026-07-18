import type { SymptomCategory } from "@pawcareright/types";

/**
 * Tap-first quick-pick descriptor chips for the symptom-intake free-text
 * step (FOUNDER-UX-1 plan). These strings feed ONLY the optional `freeText`
 * string via `buildDescriptorFreeText` (`../checks/intake.ts`) — they are
 * supplementary context for the AI, not structured `Answer`s: they do not
 * satisfy/bypass any required question and do not feed the deterministic
 * red-flag rules (those run on structured answers only). Every string below
 * is a neutral OBSERVATION: no diagnosis, no severity grade, no treatment or
 * medication language (CLAUDE §7). Pure data + lookup, no React.
 */
export const INTAKE_DESCRIPTORS: Record<SymptomCategory, readonly string[]> = {
  vomiting: [
    "Drooling more than usual",
    "Trying to bring something up with nothing coming out",
    "Belly looks bloated",
    "Ate something unusual recently",
    "Lip-licking or swallowing a lot",
    "Restless and can't settle",
  ],
  diarrhea: [
    "Straining in the litter box or outside",
    "Accidents in the house",
    "Scooting bottom along the floor",
    "Passing a lot of gas",
    "Drinking more than usual",
    "Licking their bottom a lot",
  ],
  "not-eating": [
    "Turned away from a favorite food",
    "Walked up to food then left it",
    "Drooling",
    "Quieter than usual",
    "Hiding away",
    "Lip-licking",
  ],
  limping: [
    "Holding the leg up",
    "Slower going up or down stairs",
    "Reluctant to jump",
    "Licking at the paw or leg",
    "Stiff after resting",
    "Yelped when it happened",
  ],
  "skin-itch": [
    "Scratching a lot",
    "Licking the same spot",
    "Rubbing against furniture",
    "Skin looks flaky",
    "Skin feels warm to the touch",
    "Noticed a new lump or bump",
  ],
  eyes: [
    "Pawing at the eye",
    "Keeping the eye closed",
    "Watery eye",
    "Avoiding bright light",
    "Rubbing face along the floor",
    "Eye looks different from the other one",
  ],
  ears: [
    "Tilting the head to one side",
    "Ears feel warm",
    "Flinching when the ears are touched",
    "Dark buildup inside the ear",
    "Holding one ear down",
    "Rubbing ears along the floor",
  ],
  urinary: [
    "Going to the toilet spot again and again",
    "Squatting for a long time",
    "Drinking more than usual",
    "Seems uncomfortable",
    "Restless and can't settle",
    "Urine smells stronger than usual",
  ],
  breathing: [
    "Breathing fast while resting",
    "Stretching the neck out to breathe",
    "Belly moving a lot with each breath",
    "Reluctant to lie down",
    "Tiring quickly",
    "Making a new snoring sound while awake",
  ],
  behavior: [
    "Hiding in unusual places",
    "Pacing and can't settle",
    "Clingier than usual",
    "Less interested in play",
    "Sleeping more than usual",
    "Startling easily",
  ],
  injury: [
    "Limping since it happened",
    "Holding the area very still",
    "Licking the spot",
    "Swelling where it happened",
    "Pulling away when touched there",
    "Seems dazed",
  ],
  other: [
    "Less active than usual",
    "Off their food",
    "Drinking differently",
    "Sleeping more",
    "Seems uncomfortable",
    "Something just seems off",
  ],
};

/** Looks up the quick-pick descriptor list for `categoryId`; `[]` for an unknown id. */
export function getDescriptors(categoryId: string): readonly string[] {
  return categoryId in INTAKE_DESCRIPTORS
    ? INTAKE_DESCRIPTORS[categoryId as SymptomCategory]
    : [];
}
