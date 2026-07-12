import type { Matcher, RedFlagRule } from "./types";

/**
 * The deterministic red-flag rules table (SPEC §5 rule 3 / §6.2). This table
 * IS the emergency-detection logic — it is data, not AI, and not closures
 * (plan R3): every rule is auditable by a non-engineer reviewer (the C1
 * vet-review artifact). Each rule cites its SPEC §6.2 source line, or an
 * "extra:" justification for defensible additions beyond the §6.2 list.
 *
 * Design bias: over-trigger is the SAFE direction (SPEC §5 rule 2 / decision
 * D2) — keyword matching here is negation-free and time-unaware by design.
 */

// ---- Keyword phrase groups (stored pre-normalized: lowercase, no punctuation) ----
// Distress-specific — NEVER bare organ words (avoids "breathing normally"
// false-hits — decision D2). Extending within the same intent is fine but
// must stay §7-clean (no drug/dose terms — CLAUDE §7 rule 2).

const TOXIN = [
  "ate poison",
  "ingested poison",
  "swallowed poison",
  "ate something toxic",
  "ate rat bait",
  "antifreeze",
  "toxic plant",
  "ate detergent",
  "ate pesticide",
  "licked chemical",
] as const;

const RETCH = [
  "dry heaving",
  "dry heave",
  "retching",
  "trying to vomit but nothing",
  "gagging nothing comes up",
  "unproductive vomiting",
  "trying to throw up nothing",
] as const;

const BLOAT = [
  "bloated",
  "distended belly",
  "swollen abdomen",
  "hard belly",
  "stomach is swollen",
  "belly is tight",
  "enlarged abdomen",
  // extension (same intent, plan "Keyword phrase groups" allows executor
  // extension): covers the plain "belly is swollen" phrasing used in the
  // GDV acceptance-case free text.
  "belly is swollen",
] as const;

const STRAIN_URINE = [
  "straining to pee",
  "straining to urinate",
  "cant pee",
  "cannot pee",
  // T031 checker probe gap: "hasn't peed since yesterday" — apostrophe is
  // stripped by normalize, so the stored form is "hasnt peed".
  "hasnt peed",
  "has not peed",
  "cant urinate",
  "cannot urinate",
  "blocked bladder",
  "struggling to pee",
  "in and out of litter box",
  "crying in litter box",
  "no urine coming out",
] as const;

const SEIZURE = ["seizure", "seizing", "convulsing", "convulsions", "fitting", "tremoring uncontrollably"] as const;

const COLLAPSE = [
  "collapsed",
  "unresponsive",
  "wont wake up",
  "passed out",
  "fainted",
  "unconscious",
  "limp and not responding",
] as const;

const GUMS = [
  "pale gums",
  "white gums",
  // T031 checker probe gap: "gums look white-ish" — normalize turns the
  // hyphen into a space ("white ish"); also cover the unhyphenated spelling.
  "white ish",
  "whiteish",
  "blue gums",
  "blue tongue",
  "purple gums",
  "grey gums",
  "gums are pale",
] as const;

const BREATHING = [
  "trouble breathing",
  "cant breathe",
  "cannot breathe",
  "labored breathing",
  "gasping for air",
  "struggling to breathe",
  "choking",
  "open mouth breathing cat",
  "breathing very fast and hard",
] as const;

const BLEEDING = [
  "wont stop bleeding",
  "uncontrolled bleeding",
  "bleeding heavily",
  "spurting blood",
  "gushing blood",
  "blood everywhere",
] as const;

const HEATSTROKE = [
  "heatstroke",
  "heat stroke",
  "overheated",
  "left in a hot car",
  "collapsed in the heat",
  "panting and collapsed in heat",
] as const;

const ENVENOM = [
  "snake bite",
  "bitten by a snake",
  "scorpion sting",
  "stung by a scorpion",
  "venomous bite",
] as const;

const TRAUMA = [
  "hit by a car",
  "hit by a vehicle",
  "fell from a height",
  "fell off the balcony",
  // T031 checker probe gap: "fell from the balcony" (preposition variant).
  "fell from the balcony",
  "fell out the window",
  "run over",
  "road accident",
] as const;

const EYE = [
  "eye popped out",
  "eye bulging",
  "bulging eye",
  "eyeball out",
  "suddenly blind",
  "sudden blindness",
  "cant see suddenly",
] as const;

const CANT_STAND = [
  "cant stand",
  "cannot stand",
  "cant walk suddenly",
  "dragging back legs",
  "paralyzed",
  "hind legs not working",
  "cant get up",
] as const;

const CHOCOLATE = [
  "ate chocolate",
  "ate cocoa",
  "ate brownie",
  // T031 checker probe gap: article variant "ate a brownie".
  "ate a brownie",
  "ate a chocolate bar",
  "got into the chocolate",
] as const;

const XYLITOL = ["ate gum", "sugar free gum", "xylitol", "ate sugarfree candy", "ate sweetener"] as const;

const RODENTICIDE = [
  "rat poison",
  "rodenticide",
  "mouse poison",
  "rat bait",
  "warfarin bait",
  "ate rodent poison",
] as const;

const STRING_FB = [
  "ate string",
  "swallowed thread",
  "string hanging from bottom",
  "ate yarn",
  "ate a ribbon",
  "thread stuck",
] as const;

const BLOOD_URINE = ["blood in urine", "bloody pee", "peeing blood", "pink urine", "red urine"] as const;

const FRACTURE_WOUND = [
  "bone sticking out",
  "open fracture",
  "deep cut",
  "deep gash",
  "deep wound",
  "large open wound",
] as const;

const DYSTOCIA = [
  "in labor too long",
  "prolonged labor",
  "straining to give birth",
  "stuck puppy",
  "stuck kitten",
  "pushing for hours",
  "cant deliver",
] as const;

const NEONATAL = [
  "newborn puppy limp",
  "newborn kitten limp",
  "neonate collapsed",
  "fading puppy",
  "fading kitten",
] as const;

const WEAK_NEWBORN = ["limp", "cold and weak", "not nursing", "wont feed", "floppy and cold"] as const;

// ---- The 22-rule table (declaration order = tie-break order, plan §Engine) ----

export const RED_FLAG_RULES: readonly RedFlagRule[] = [
  // 1 — SPEC §6.2: suspected toxin ingestion
  {
    id: "toxin-ingestion",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "toxin-ingestion",
    label: "suspected toxin ingestion",
    sourceRef: "SPEC §6.2: suspected toxin ingestion",
    match: { anyOf: [{ field: "sign", sign: "toxin_ingestion" }, { kw: TOXIN }] },
  },
  // 2 — SPEC §6.2: unproductive retching + distended abdomen (dog → GDV)
  {
    id: "gdv-suspected",
    species: "DOG",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "gdv-suspected",
    label: "unproductive retching with distended abdomen (dog)",
    sourceRef: "SPEC §6.2: unproductive retching + distended abdomen (dog → GDV)",
    match: {
      allOf: [
        { field: "species", op: "eq", value: "DOG" },
        { anyOf: [{ field: "sign", sign: "retching_unproductive" }, { kw: RETCH }] },
        { anyOf: [{ field: "sign", sign: "distended_abdomen" }, { kw: BLOAT }] },
      ],
    },
  },
  // 3 — SPEC §6.2: male cat straining to urinate
  {
    id: "urinary-blockage-cat",
    species: "CAT",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "urinary-blockage-cat",
    label: "male cat straining to urinate",
    sourceRef: "SPEC §6.2: male cat straining to urinate",
    match: {
      allOf: [
        { field: "species", op: "eq", value: "CAT" },
        { field: "sex", op: "in", value: ["MALE", "UNKNOWN"] },
        { anyOf: [{ field: "sign", sign: "straining_to_urinate" }, { kw: STRAIN_URINE }] },
      ],
    },
  },
  // 4 — SPEC §6.2: seizure >2 min or repeated
  {
    id: "seizure-prolonged-or-repeated",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "seizure-prolonged-or-repeated",
    label: "prolonged or repeated seizure",
    sourceRef: "SPEC §6.2: seizure >2 min or repeated",
    match: { anyOf: [{ field: "sign", sign: "seizure_prolonged_or_repeated" }, { kw: SEIZURE }] },
  },
  // 5 — SPEC §6.2: collapse/unresponsive
  {
    id: "collapse-unresponsive",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "collapse-unresponsive",
    label: "collapse or unresponsiveness",
    sourceRef: "SPEC §6.2: collapse/unresponsive",
    match: { anyOf: [{ field: "sign", sign: "collapse_unresponsive" }, { kw: COLLAPSE }] },
  },
  // 6 — SPEC §6.2: pale/blue/white gums
  {
    id: "abnormal-gum-color",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "abnormal-gum-color",
    label: "abnormal gum color",
    sourceRef: "SPEC §6.2: pale/blue/white gums",
    match: { anyOf: [{ field: "sign", sign: "abnormal_gum_color" }, { kw: GUMS }] },
  },
  // 7 — SPEC §6.2: difficulty breathing
  {
    id: "breathing-difficulty",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "breathing-difficulty",
    label: "breathing difficulty",
    sourceRef: "SPEC §6.2: difficulty breathing",
    match: { anyOf: [{ field: "sign", sign: "breathing_difficulty" }, { kw: BREATHING }] },
  },
  // 8 — SPEC §6.2: uncontrolled bleeding
  {
    id: "uncontrolled-bleeding",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "uncontrolled-bleeding",
    label: "uncontrolled bleeding",
    sourceRef: "SPEC §6.2: uncontrolled bleeding",
    match: { anyOf: [{ field: "sign", sign: "uncontrolled_bleeding" }, { kw: BLEEDING }] },
  },
  // 9 — SPEC §6.2: suspected heatstroke
  {
    id: "heatstroke",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "heatstroke",
    label: "suspected heatstroke",
    sourceRef: "SPEC §6.2: suspected heatstroke",
    match: { anyOf: [{ field: "sign", sign: "heatstroke" }, { kw: HEATSTROKE }] },
  },
  // 10 — SPEC §6.2: snake/scorpion envenomation
  {
    id: "envenomation",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "envenomation",
    label: "suspected envenomation",
    sourceRef: "SPEC §6.2: snake/scorpion envenomation",
    match: { anyOf: [{ field: "sign", sign: "envenomation" }, { kw: ENVENOM }] },
  },
  // 11 — SPEC §6.2: trauma (hit by vehicle, fall from height)
  {
    id: "major-trauma",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "major-trauma",
    label: "major trauma",
    sourceRef: "SPEC §6.2: trauma (hit by vehicle, fall from height)",
    match: { anyOf: [{ field: "sign", sign: "major_trauma" }, { kw: TRAUMA }] },
  },
  // 12 — SPEC §6.2: eye bulging / sudden blindness
  {
    id: "ocular-emergency",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "ocular-emergency",
    label: "ocular emergency",
    sourceRef: "SPEC §6.2: eye bulging / sudden blindness",
    match: { anyOf: [{ field: "sign", sign: "ocular_emergency" }, { kw: EYE }] },
  },
  // 13 — SPEC §6.2: inability to stand in previously mobile animal
  {
    id: "sudden-inability-to-stand",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "sudden-inability-to-stand",
    label: "sudden inability to stand",
    sourceRef: "SPEC §6.2: inability to stand in previously mobile animal",
    match: { anyOf: [{ field: "sign", sign: "unable_to_stand" }, { kw: CANT_STAND }] },
  },
  // 14 — extra: theobromine toxicity, established dog emergency
  {
    id: "chocolate-ingestion-dog",
    species: "DOG",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "chocolate-ingestion-dog",
    label: "chocolate ingestion (dog)",
    sourceRef: "extra: theobromine toxicity, established dog emergency",
    match: {
      allOf: [
        { field: "species", op: "eq", value: "DOG" },
        { anyOf: [{ field: "sign", sign: "chocolate_ingestion" }, { kw: CHOCOLATE }] },
      ],
    },
  },
  // 15 — extra: xylitol / sugar-free gum toxicity, dog
  {
    id: "xylitol-ingestion-dog",
    species: "DOG",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "xylitol-ingestion-dog",
    label: "xylitol ingestion (dog)",
    sourceRef: "extra: xylitol / sugar-free gum toxicity, dog",
    match: {
      allOf: [
        { field: "species", op: "eq", value: "DOG" },
        { anyOf: [{ field: "sign", sign: "xylitol_ingestion" }, { kw: XYLITOL }] },
      ],
    },
  },
  // 16 — extra: anticoagulant rodenticide exposure
  {
    id: "rodenticide-exposure",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "rodenticide-exposure",
    label: "rodenticide exposure",
    sourceRef: "extra: anticoagulant rodenticide exposure",
    match: { anyOf: [{ field: "sign", sign: "rodenticide_exposure" }, { kw: RODENTICIDE }] },
  },
  // 17 — extra: string / linear foreign body, cat
  {
    id: "linear-foreign-body-cat",
    species: "CAT",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "linear-foreign-body-cat",
    label: "linear foreign body (cat)",
    sourceRef: "extra: string / linear foreign body, cat",
    match: {
      allOf: [
        { field: "species", op: "eq", value: "CAT" },
        { anyOf: [{ field: "sign", sign: "linear_foreign_body" }, { kw: STRING_FB }] },
      ],
    },
  },
  // 18 — extra: bloated/hard abdomen alone (both species). Intentionally
  // overlaps rule 2 (plan R8): bloat-ALONE fires this generic rule; a dog
  // with BOTH retching + bloat fires the more specific `gdv-suspected`
  // instead — distinct payload keys ⇒ distinct T036 interstitials, both
  // EMERGENCY.
  {
    id: "distended-abdomen",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "distended-abdomen",
    label: "distended abdomen",
    sourceRef: "extra: bloated/hard abdomen alone (both species)",
    match: { anyOf: [{ field: "sign", sign: "distended_abdomen" }, { kw: BLOAT }] },
  },
  // 19 — extra: straining + blood in urine, any cat
  {
    id: "urinary-obstruction-signs-cat",
    species: "CAT",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "urinary-obstruction-signs-cat",
    label: "straining to urinate with blood in urine (cat)",
    sourceRef: "extra: straining + blood in urine, any cat",
    match: {
      allOf: [
        { field: "species", op: "eq", value: "CAT" },
        { anyOf: [{ field: "sign", sign: "straining_to_urinate" }, { kw: STRAIN_URINE }] },
        { anyOf: [{ field: "sign", sign: "blood_in_urine" }, { kw: BLOOD_URINE }] },
      ],
    },
  },
  // 20 — extra: open fracture / deep wound
  {
    id: "open-fracture-or-deep-wound",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "open-fracture-or-deep-wound",
    label: "open fracture or deep wound",
    sourceRef: "extra: open fracture / deep wound",
    match: { anyOf: [{ field: "sign", sign: "open_fracture_or_deep_wound" }, { kw: FRACTURE_WOUND }] },
  },
  // 21 — extra: dystocia / prolonged labor
  {
    id: "birthing-distress",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "birthing-distress",
    label: "birthing distress",
    sourceRef: "extra: dystocia / prolonged labor",
    match: { anyOf: [{ field: "sign", sign: "birthing_distress" }, { kw: DYSTOCIA }] },
  },
  // 22 — extra: newborn / pediatric collapse
  {
    id: "neonatal-collapse",
    species: "ANY",
    tierFloor: "EMERGENCY_NOW",
    emergencyPayloadKey: "neonatal-collapse",
    label: "neonatal collapse",
    sourceRef: "extra: newborn / pediatric collapse",
    match: {
      anyOf: [
        { field: "sign", sign: "neonatal_collapse" },
        { kw: NEONATAL },
        {
          allOf: [
            { field: "ageMonths", op: "lte", value: 1 },
            { anyOf: [{ field: "sign", sign: "collapse_unresponsive" }, { kw: WEAK_NEWBORN }] },
          ],
        },
      ],
    } satisfies Matcher,
  },
] as const;

Object.freeze(RED_FLAG_RULES);
