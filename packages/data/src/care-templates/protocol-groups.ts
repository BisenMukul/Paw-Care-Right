import type { ProtocolGroup } from "./schema";

/**
 * ISO 3166-1 alpha-2 country code -> coarse vaccine-protocol group
 * (Decision R2). This is a NEW, coarser axis local to this package,
 * deliberately DIFFERENT from `packages/data/src/regions` (T049's
 * per-country emergency/poison-hotline dataset) — do not conflate the two
 * or edit `regions/` from here. Unknown/undefined country -> `"DEFAULT"`
 * (a safe global baseline), matching Decision R6's fail-safe philosophy.
 */
const COUNTRY_TO_PROTOCOL_GROUP: Record<string, ProtocolGroup> = {
  // NA
  US: "NA",
  CA: "NA",
  MX: "NA",
  // EU
  DE: "EU",
  FR: "EU",
  ES: "EU",
  IT: "EU",
  NL: "EU",
  BE: "EU",
  PT: "EU",
  IE: "EU",
  AT: "EU",
  SE: "EU",
  DK: "EU",
  FI: "EU",
  PL: "EU",
  GR: "EU",
  // UK
  GB: "UK",
  // IN
  IN: "IN",
  // BR
  BR: "BR",
  // MENA
  AE: "MENA",
  SA: "MENA",
  EG: "MENA",
  QA: "MENA",
  KW: "MENA",
  OM: "MENA",
  BH: "MENA",
  JO: "MENA",
  MA: "MENA",
  DZ: "MENA",
  TN: "MENA",
  // SEA
  SG: "SEA",
  MY: "SEA",
  TH: "SEA",
  ID: "SEA",
  PH: "SEA",
  VN: "SEA",
  // AU
  AU: "AU",
  NZ: "AU",
};

/** Unknown/undefined country code -> `"DEFAULT"`. Case-insensitive. */
export function protocolGroupForCountry(countryCode?: string | null): ProtocolGroup {
  if (!countryCode) {
    return "DEFAULT";
  }
  const normalized = countryCode.trim().toUpperCase();
  return COUNTRY_TO_PROTOCOL_GROUP[normalized] ?? "DEFAULT";
}
