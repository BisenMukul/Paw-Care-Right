import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type IconName = ComponentProps<typeof Ionicons>["name"];

// PREVIEW-1 plan: the ONLY data source for the tap-through service-flow
// preview screens (`app/services/*`). Everything below is fictional -- no
// real businesses, phone numbers, addresses, emails, or URLs; no
// medication/dosing products; adopt fixtures are rescue/adoption-framed
// (never breeder/sale). `apps/mobile/__tests__/services-preview-fixtures
// .test.ts` scans every string exported from this module for that record.

export type PreviewVetMode = "video" | "clinic" | "home";

export interface PreviewVetModeOption {
  key: PreviewVetMode;
  label: string;
}

export const PREVIEW_VET_MODES: PreviewVetModeOption[] = [
  { key: "video", label: "Video" },
  { key: "clinic", label: "Clinic" },
  { key: "home", label: "Home visit" },
];

export interface PreviewVet {
  id: string;
  name: string;
  specialty: string;
  experience: string;
  rating: number;
  reviews: string;
  initial: string;
}

interface PreviewVetSource {
  id: string;
  name: string;
  specialty: string;
  experience: string;
  rating: number;
  reviews: string;
}

/** First-name initial, derived from the fixture name rather than hand-typed per entry (plan: "initials derived in code"). */
function initialFromName(name: string): string {
  const withoutTitle = name.replace(/^Dr\.\s*/, "");
  return withoutTitle.charAt(0);
}

const PREVIEW_VET_SOURCE: PreviewVetSource[] = [
  {
    id: "vet-1",
    name: "Dr. Maya Rivera",
    specialty: "Small-animal medicine",
    experience: "8 yrs",
    rating: 4.9,
    reviews: "120+ reviews",
  },
  {
    id: "vet-2",
    name: "Dr. Aran Patel",
    specialty: "Feline health",
    experience: "6 yrs",
    rating: 4.8,
    reviews: "90+ reviews",
  },
  {
    id: "vet-3",
    name: "Dr. Noor Haddad",
    specialty: "Skin & coat",
    experience: "10 yrs",
    rating: 4.7,
    reviews: "60+ reviews",
  },
  {
    id: "vet-4",
    name: "Dr. Leo Fontaine",
    specialty: "General practice",
    experience: "5 yrs",
    rating: 4.9,
    reviews: "40+ reviews",
  },
];

export const PREVIEW_VETS: PreviewVet[] = PREVIEW_VET_SOURCE.map((vet) => ({
  ...vet,
  initial: initialFromName(vet.name),
}));

export interface PreviewSalon {
  id: string;
  name: string;
  detail: string;
  icon: IconName;
}

export const PREVIEW_SALONS: PreviewSalon[] = [
  { id: "salon-1", name: "Fluff & Fold Grooming", detail: "Full groom · 90 min", icon: "cut-outline" },
  { id: "salon-2", name: "The Happy Tail Spa", detail: "Bath & brush · 45 min", icon: "sparkles-outline" },
  { id: "salon-3", name: "Whisker Works", detail: "Nail & ear care · 30 min", icon: "paw-outline" },
  { id: "salon-4", name: "Paws & Relax", detail: "Spa day · 120 min", icon: "leaf-outline" },
];

export interface PreviewStoreProduct {
  id: string;
  name: string;
  tag: string;
  icon: IconName;
}

// Toys/food/grooming only -- no supplement/vitamin/medication/dosing product
// anywhere in this list (CLAUDE §7 / plan Safety).
export const PREVIEW_STORE_PRODUCTS: PreviewStoreProduct[] = [
  { id: "product-1", name: "Cozy Fleece Bed", tag: "Comfort", icon: "bed-outline" },
  { id: "product-2", name: "Chew-Tough Rope Toy", tag: "Play", icon: "tennisball-outline" },
  { id: "product-3", name: "Salmon Crunch Treats", tag: "Treats", icon: "restaurant-outline" },
  { id: "product-4", name: "Everyday Dry Food", tag: "Food", icon: "nutrition-outline" },
  { id: "product-5", name: "Gentle Slicker Brush", tag: "Grooming", icon: "color-wand-outline" },
  { id: "product-6", name: "Oatmeal Pet Shampoo", tag: "Grooming", icon: "water-outline" },
];

// Local literal union (not imported from `@pawcareright/types`) -- plan step
// 2: "do NOT import api types that would pull store deps".
export type PreviewAdoptSpecies = "DOG" | "CAT";

export interface PreviewAdoptPet {
  id: string;
  name: string;
  mix: string;
  species: PreviewAdoptSpecies;
  meta: string;
  vaccinated: boolean;
  listedBy: string;
}

// Dogs + cats only, rescue framing, no breeder/sale/price anywhere (CLAUDE
// §7 / plan Safety -- "§7-clean adopt content").
export const PREVIEW_ADOPT_PETS: PreviewAdoptPet[] = [
  {
    id: "pet-1",
    name: "Biscuit",
    mix: "Indie mix",
    species: "DOG",
    meta: "1 yr · Male",
    vaccinated: true,
    listedBy: "Sunrise Animal Shelter (sample)",
  },
  {
    id: "pet-2",
    name: "Pepper",
    mix: "Domestic shorthair",
    species: "CAT",
    meta: "2 yrs · Female",
    vaccinated: true,
    listedBy: "Paws Rescue (sample)",
  },
  {
    id: "pet-3",
    name: "Rusty",
    mix: "Labrador mix",
    species: "DOG",
    meta: "3 yrs · Male",
    vaccinated: false,
    listedBy: "Sunrise Animal Shelter (sample)",
  },
  {
    id: "pet-4",
    name: "Clover",
    mix: "Tabby mix",
    species: "CAT",
    meta: "8 mo · Female",
    vaccinated: true,
    listedBy: "Paws Rescue (sample)",
  },
];

/** Shared "About" read-only blurb every adopt-detail preview renders (plan enumeration). */
export const PREVIEW_ADOPT_ABOUT_BLURB =
  "A gentle, playful companion looking for a loving home. Good with kids and other pets, and up to date on basic health checks.";

/** Relative day labels only -- no real calendar dates in a preview. */
export const PREVIEW_SLOT_DAYS: string[] = ["Today", "Tomorrow", "Sat", "Sun", "Mon"];

export const PREVIEW_SLOT_TIMES: string[] = ["9:00", "10:30", "12:00", "2:30", "4:00", "5:30"];
