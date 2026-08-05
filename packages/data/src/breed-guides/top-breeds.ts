/**
 * The 50 pinned top-breed slugs (T084 plan D8). Every slug below was
 * verified (step 1) to exist in the T022 `dogBreeds`/`catBreeds` dataset,
 * with no duplicates and no `mixed-unknown` (D2: nothing true can be said
 * about an unknown mix). `breed-guides.spec.ts` asserts both directions:
 * every pinned slug has a guide, and every guide is a pinned slug.
 */
export const TOP_DOG_BREED_GUIDE_SLUGS = [
  "labrador-retriever",
  "golden-retriever",
  "german-shepherd",
  "french-bulldog",
  "standard-poodle",
  "pembroke-welsh-corgi",
  "dachshund",
  "beagle",
  "rottweiler",
  "german-shorthaired-pointer",
  "yorkshire-terrier",
  "boxer",
  "cavalier-king-charles-spaniel",
  "doberman-pinscher",
  "australian-shepherd",
  "miniature-schnauzer",
  "cane-corso",
  "shih-tzu",
  "boston-terrier",
  "bernese-mountain-dog",
  "pomeranian",
  "havanese",
  "shiba-inu",
  "border-collie",
  "chihuahua",
  "great-dane",
  "siberian-husky",
  "akita",
  "american-cocker-spaniel",
  "maltese",
  "weimaraner",
  "vizsla",
  "west-highland-white-terrier",
  "newfoundland",
  "saint-bernard",
  "brittany",
  "english-mastiff",
  "collie",
] as const;

export const TOP_CAT_BREED_GUIDE_SLUGS = [
  "maine-coon",
  "persian",
  "siamese",
  "ragdoll",
  "british-shorthair",
  "abyssinian",
  "sphynx",
  "bengal",
  "russian-blue",
  "scottish-fold",
  "american-shorthair",
  "devon-rex",
] as const;

export const TOP_BREED_GUIDE_COUNT = TOP_DOG_BREED_GUIDE_SLUGS.length + TOP_CAT_BREED_GUIDE_SLUGS.length;
