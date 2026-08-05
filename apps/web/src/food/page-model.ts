// Presentation-ready model for one `/can-{species}-eat/{item}` page (T085).
// `buildFoodPageModel` is the single place that turns a dataset row into
// every string the page renders — no component invents toxicology text.
import { toxins, type ToxinRow } from "@bombaypetcompany/data";

import { strings } from "../strings";
import { SITE_URL } from "../site";
import { SPECIES_SEGMENTS, speciesBySegment, type SpeciesDescriptor } from "./species";

export interface FoodFaqEntry {
  question: string;
  answer: string;
}

export interface FoodCrossLink {
  href: string;
  label: string;
}

export interface FoodPageModel {
  segment: SpeciesDescriptor["segment"];
  species: SpeciesDescriptor;
  itemId: string;
  itemName: string; // row.name VERBATIM (D8)
  category: string; // row.category
  verdict: "safe" | "caution" | "toxic" | "emergency";
  verdictLabel: string; // short badge
  verdictHeadline: string; // hero line
  note: string; // row.note VERBATIM
  quantityNuance?: string; // row.quantityNuance VERBATIM
  whatToDo: string; // verdict-tier constant, NEVER item-specific
  showHotlineCta: boolean; // === (verdict === "toxic" || verdict === "emergency")   [D7]
  otherSpecies: FoodCrossLink; // same item, other species
  relatedItems: FoodCrossLink[]; // ≤6, same category, deterministic, excludes self
  canonicalUrl: string; // `${SITE_URL}/${segment}/${itemId}`
  title: string; // `Can ${plural} eat ${itemName}?`
  description: string; // metaDescription(): ≤155 chars, word-boundary truncated with "…"
  faq: FoodFaqEntry[]; // 2 entries, or 3 when quantityNuance exists   [D10]
}

/**
 * `relatedItems` determinism (pin exactly): rows of the same category, in
 * dataset order, walking forward from `row`'s index with wrap-around,
 * stopping before returning to `row` itself, up to 6 entries.
 */
export function relatedItems(row: ToxinRow, segment: SpeciesDescriptor["segment"]): FoodCrossLink[] {
  const sameCategory = toxins.filter((t) => t.category === row.category);
  const total = sameCategory.length;
  const selfIndex = sameCategory.findIndex((t) => t.id === row.id);
  const result: FoodCrossLink[] = [];

  for (let step = 1; step < total && result.length < 6; step++) {
    const candidate = sameCategory[(selfIndex + step) % total];
    if (!candidate || candidate.id === row.id) {
      break;
    }
    result.push({ href: `/${segment}/${candidate.id}`, label: candidate.name });
  }

  return result;
}

const MAX_DESCRIPTION_LENGTH = 155;

/** `${verdictHeadline}. ${note}`, truncated at the last word boundary. */
export function metaDescription(input: { verdictHeadline: string; note: string }): string {
  const raw = `${input.verdictHeadline}. ${input.note}`;
  if (raw.length <= MAX_DESCRIPTION_LENGTH) {
    return raw;
  }
  const truncated = raw.slice(0, MAX_DESCRIPTION_LENGTH - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${cut}…`;
}

/** `Can ${plural} eat ${itemName}?` — item name rendered verbatim (D8). */
export function pageTitle(input: { species: SpeciesDescriptor; itemName: string }): string {
  return `Can ${input.species.plural} eat ${input.itemName}?`;
}

/** Unknown segment or unknown item id ⇒ null (caller calls notFound()). */
export function buildFoodPageModel(segment: string, itemId: string): FoodPageModel | null {
  const species = speciesBySegment(segment);
  if (!species) {
    return null;
  }

  const row = toxins.find((t) => t.id === itemId);
  if (!row) {
    return null;
  }

  const verdict = row.verdicts[species.verdictKey];
  const verdictLabel = strings.foodPage.verdictLabel[verdict];
  const verdictHeadline = strings.foodPage.verdictHeadline[verdict](species.plural);
  const whatToDo = strings.foodPage.whatToDo[verdict];
  const showHotlineCta = verdict === "toxic" || verdict === "emergency";

  const otherSegment = SPECIES_SEGMENTS.find((s) => s !== species.segment);
  const otherDescriptor = otherSegment ? speciesBySegment(otherSegment) : undefined;
  if (!otherDescriptor) {
    // Unreachable with the current two-segment set (D2); guards against a
    // future segment addition silently producing a broken cross-link.
    throw new Error(`no counterpart segment found for ${species.segment}`);
  }
  const otherSpecies: FoodCrossLink = {
    href: `/${otherDescriptor.segment}/${row.id}`,
    label: strings.foodPage.otherSpeciesLabel(otherDescriptor.Plural, row.name),
  };

  const faq: FoodFaqEntry[] = [
    {
      question: strings.foodPage.faq.q1(species.plural, row.name),
      answer: `${verdictHeadline}. ${row.note}`,
    },
    ...(row.quantityNuance
      ? [
          {
            question: strings.foodPage.faq.q2(species.plural, row.name),
            answer: row.quantityNuance,
          },
        ]
      : []),
    {
      question: strings.foodPage.faq.q3(species.singular, row.name),
      answer: whatToDo,
    },
  ];

  return {
    segment: species.segment,
    species,
    itemId: row.id,
    itemName: row.name,
    category: row.category,
    verdict,
    verdictLabel,
    verdictHeadline,
    note: row.note,
    ...(row.quantityNuance !== undefined ? { quantityNuance: row.quantityNuance } : {}),
    whatToDo,
    showHotlineCta,
    otherSpecies,
    relatedItems: relatedItems(row, species.segment),
    canonicalUrl: `${SITE_URL}/${species.segment}/${itemId}`,
    title: pageTitle({ species, itemName: row.name }),
    description: metaDescription({ verdictHeadline, note: row.note }),
    faq,
  };
}
