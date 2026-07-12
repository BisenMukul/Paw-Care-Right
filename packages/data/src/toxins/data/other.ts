import type { ToxinRowInput } from "../schema";

/**
 * Sources consulted (names only — no copied prose, no URLs; T035 R9):
 * ASPCA Animal Poison Control Center, Pet Poison Helpline, Merck Veterinary
 * Manual. Every note below is written in our own words and is qualitative
 * only — no dosing amounts, no diagnosis language.
 */
export const other: ToxinRowInput[] = [
  {
    id: "tea-tree-oil",
    name: "Tea tree oil",
    category: "other",
    verdicts: { dog: "emergency", cat: "emergency" },
    note: "Undiluted tea tree oil, whether swallowed or applied to the skin, is a classic and serious cause of poisoning in pets, affecting the nervous system and causing severe wobbliness or tremors.",
    aliases: ["melaleuca oil"],
  },
  {
    id: "essential-oils-general",
    name: "Concentrated essential oils (general)",
    category: "other",
    verdicts: { dog: "emergency", cat: "emergency" },
    note: "Concentrated essential oils such as wintergreen, pennyroyal, or cinnamon oil can cause severe chemical burns to the mouth and gut, and cats in particular struggle to break these compounds down safely.",
    aliases: ["wintergreen oil", "pennyroyal oil", "diffuser oil"],
  },
  {
    id: "cannabis-marijuana",
    name: "Cannabis (marijuana)",
    category: "other",
    verdicts: { dog: "toxic", cat: "toxic" },
    note: "Cannabis, whether smoked, raw, or baked into food, can cause profound wobbliness, disorientation, and changes in heart rate; edibles carry the added risk of chocolate or xylitol.",
    aliases: ["marijuana", "weed", "thc edibles"],
  },
  {
    id: "nicotine-tobacco",
    name: "Nicotine and tobacco",
    category: "other",
    verdicts: { dog: "toxic", cat: "toxic" },
    note: "Nicotine overstimulates the nervous system, causing drooling, tremors, and a racing heart, and in a large exposure can progress to weakness and breathing trouble; vaping liquid is especially concentrated.",
    aliases: ["cigarettes", "vape liquid", "e-cigarette liquid", "nicotine gum", "nicotine patch"],
  },
  {
    id: "alcohol-hand-sanitizer",
    name: "Alcohol-based hand sanitizer",
    category: "other",
    verdicts: { dog: "toxic", cat: "toxic" },
    note: "Hand sanitizer is concentrated alcohol and can cause the same dangerous drop in body temperature, blood sugar, and coordination as drinking alcohol directly.",
    aliases: ["hand sanitizer", "hand gel"],
  },
  {
    id: "glow-sticks",
    name: "Glow sticks and glow jewellery",
    category: "other",
    verdicts: { dog: "caution", cat: "caution" },
    note: "The liquid inside glow sticks tastes extremely bitter and usually causes immediate drooling and foaming rather than serious poisoning, though it can still upset the stomach.",
    aliases: ["glow jewelry", "glow bracelet"],
  },
  {
    id: "salt-dough",
    name: "Homemade salt dough or playdough",
    category: "other",
    verdicts: { dog: "emergency", cat: "emergency" },
    note: "Homemade craft dough is often made with a large amount of salt, and eating even a small piece can disturb the body's normal sodium balance and affect the nervous system.",
    aliases: ["playdough", "salt clay"],
  },
  {
    id: "cigarette-butts",
    name: "Used cigarette butts",
    category: "other",
    verdicts: { dog: "toxic", cat: "toxic" },
    note: "Used cigarette butts still contain concentrated nicotine residue and can cause drooling, tremors, and a racing heart if eaten.",
    aliases: ["ash tray butts"],
  },
  {
    id: "hallucinogenic-mushrooms",
    name: "Hallucinogenic mushrooms",
    category: "other",
    verdicts: { dog: "emergency", cat: "emergency" },
    note: "Hallucinogenic mushroom species can cause severe disorientation, tremors, and a dangerously high body temperature, and it is often impossible to be sure which species a pet has actually eaten.",
    aliases: ["psilocybin mushrooms", "magic mushrooms"],
  },
  {
    id: "kratom",
    name: "Kratom",
    category: "other",
    verdicts: { dog: "toxic", cat: "toxic" },
    note: "Kratom is an unregulated herbal supplement with opioid-like effects, and pet exposure data is limited, so any exposure should be treated cautiously as it can cause sedation or agitation.",
    aliases: [],
  },
  {
    id: "cbd-oil-pet-product",
    name: "CBD oil or pet CBD product",
    category: "other",
    verdicts: { dog: "caution", cat: "caution" },
    note: "Hemp-derived CBD products are generally lower risk than THC-containing cannabis, but they are not standardised, and a pet getting into a full bottle rather than a measured serving can cause sedation or stomach upset.",
    aliases: ["hemp oil"],
  },
];
