// Shared, fixed layout constants for the pet-home screen (T025 plan).
// These are the SAME numbers applied as explicit style values on the header
// region / header card / CTA in `app/pets/[id].tsx` and
// `src/components/pet-header-card.tsx` — the above-the-fold budget test
// (plan §AC2b) binds its arithmetic to those actually-applied styles, not to
// an independent literal, so the assertion is non-vacuous. Pure module, no
// imports.
export const SE_WINDOW = { width: 320, height: 568 } as const; // iPhone SE

export const SAFE_AREA_TOP_RESERVE = 44; // status bar / notch reserve, SE-class
export const HEADER_CARD_HEIGHT = 140; // photo + name + age + breed, fixed
export const SECTION_GAP = 16;
export const CTA_HEIGHT = 56;

// Top-of-screen through the bottom of the CTA:
export const ABOVE_FOLD_BUDGET =
  SAFE_AREA_TOP_RESERVE + HEADER_CARD_HEIGHT + SECTION_GAP + CTA_HEIGHT; // = 256 <= 568
