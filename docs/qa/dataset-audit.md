# Dataset & seed QA audit — T105

> GENERATED FILE — do not hand-edit. Regenerate with `pnpm --filter @bombaypetcompany/data qa:dataset-audit`; drift from the live datasets is caught by `packages/data/src/qa/dataset-audit-doc.spec.ts`.

## 1. Scope & method

This audit is generated directly from the datasets in `packages/data` by `computeDatasetAudit()` / `renderDatasetAuditDoc()` (`packages/data/src/qa/dataset-audit.ts`). It reports dataset counts, a deterministic top-100 toxin-verdict spot-check, a region hotline verification table, and a breed-guide reviewed-flag inventory. It does not verify anything against the outside world — see section 8.

## 2. Dataset counts

| Dataset | Count |
|---|---|
| Dog breeds | 358 |
| Cat breeds | 82 |
| Breeds total | 440 |
| Toxins total | 233 |
| Toxins — human-food | 98 |
| Toxins — plant | 58 |
| Toxins — household-chemical | 26 |
| Toxins — human-med | 25 |
| Toxins — pest-bait | 15 |
| Toxins — other | 11 |
| Hotline regions | 5 |
| Breed guides total | 50 |
| Breed guides — dog | 38 |
| Breed guides — cat | 12 |
| Breed guides — reviewed (published) | 5 |
| Breed guides — unreviewed (draft) | 45 |
| Care-template protocol groups | 9 |
| Care-template life stages | 3 |
| Emergency payloads | 22 |

## 3. Toxin sources list (category-level — T035 R9)

Per T035 decision R9, `ToxinRow` (packages/data/src/toxins/schema.ts) carries no per-row source field. Sources were recorded once per category, as a file-header comment in each `packages/data/src/toxins/data/*.ts` file. This is **category-level attribution, not per-verdict citation** — see section 8.

| Category | Data file | Row count | Sources consulted |
|---|---|---|---|
| human-food | human-foods.ts | 98 | ASPCA Animal Poison Control Center, Pet Poison Helpline, Merck Veterinary Manual |
| plant | plants.ts | 58 | ASPCA Animal Poison Control Center, Pet Poison Helpline, Merck Veterinary Manual |
| household-chemical | household-chemicals.ts | 26 | ASPCA Animal Poison Control Center, Pet Poison Helpline, Merck Veterinary Manual |
| human-med | human-meds.ts | 25 | ASPCA Animal Poison Control Center, Pet Poison Helpline, Merck Veterinary Manual |
| pest-bait | pest-baits.ts | 15 | ASPCA Animal Poison Control Center, Pet Poison Helpline, Merck Veterinary Manual |
| other | other.ts | 11 | ASPCA Animal Poison Control Center, Pet Poison Helpline, Merck Veterinary Manual |

## 4. Top-100 toxin verdict spot-check

This section spot-checks 100 of the 233 toxin rows against the category-level sources list in section 3.

### 4.1 How "top 100" is defined

`ToxinRow` carries no popularity, commonness, or search-frequency field, so no ranking by "most commonly searched" is possible from this dataset. The only severity signal already present is `FOOD_VERDICT_SEVERITY` (`safe:0 < caution:1 < toxic:2 < emergency:3`, `packages/types/src/food-safety.ts`). The rows below are the top 100 by this deterministic order: (1) `max(dog, cat)` severity, descending; (2) `min(dog, cat)` severity, descending; (3) category index in `TOXIN_CATEGORIES`, ascending; (4) `id`, ascending (plain ASCII comparison — ids are already kebab-case, so no locale-dependent comparison is used). This deliberately biases the window toward `toxic`/`emergency` rows, which is the correct bias for a safety spot-check, not toward whatever items are most frequently asked about in the app.

### 4.2 Mechanical checks vs. human checks

Mechanical checks — already enforced by the schema meta-tests in section 7 — cover: schema-enum validity of every verdict/category, id/alias-key uniqueness, category-level source presence (section 3), the 5 pinned anchor verdicts, the section-7-numbered dosing/diagnosis language scan, and this document's own doc-to-data drift check. [VET] None of those checks can judge whether a verdict is medically correct for a given species — that is a human judgement. Every one of the 100 rows below therefore carries `UNVERIFIED` in its verdict-correctness column until a licensed veterinarian reviews it.

### 4.3 The 100 rows

| Rank | Id | Name | Category | Dog | Cat | Sources | Verdict correctness (human) |
|---|---|---|---|---|---|---|---|
| 1 | alcohol | Alcohol | human-food | emergency | emergency | 3 | UNVERIFIED |
| 2 | hops | Hops | human-food | emergency | emergency | 3 | UNVERIFIED |
| 3 | moldy-food | Moldy or spoiled food | human-food | emergency | emergency | 3 | UNVERIFIED |
| 4 | raw-bread-dough | Raw bread or pizza dough | human-food | emergency | emergency | 3 | UNVERIFIED |
| 5 | wild-mushrooms | Wild mushrooms | human-food | emergency | emergency | 3 | UNVERIFIED |
| 6 | autumn-crocus | Autumn crocus | plant | emergency | emergency | 3 | UNVERIFIED |
| 7 | castor-bean | Castor bean | plant | emergency | emergency | 3 | UNVERIFIED |
| 8 | deadly-nightshade | Deadly nightshade | plant | emergency | emergency | 3 | UNVERIFIED |
| 9 | foxglove | Foxglove | plant | emergency | emergency | 3 | UNVERIFIED |
| 10 | lily-of-the-valley | Lily of the valley | plant | emergency | emergency | 3 | UNVERIFIED |
| 11 | oleander | Oleander | plant | emergency | emergency | 3 | UNVERIFIED |
| 12 | sago-palm | Sago palm | plant | emergency | emergency | 3 | UNVERIFIED |
| 13 | yew | Yew | plant | emergency | emergency | 3 | UNVERIFIED |
| 14 | antifreeze | Antifreeze (ethylene glycol) | household-chemical | emergency | emergency | 3 | UNVERIFIED |
| 15 | battery-ingestion | Batteries (button and lithium cells) | household-chemical | emergency | emergency | 3 | UNVERIFIED |
| 16 | drain-cleaner | Drain cleaner | household-chemical | emergency | emergency | 3 | UNVERIFIED |
| 17 | laundry-detergent-pods | Laundry detergent pods | household-chemical | emergency | emergency | 3 | UNVERIFIED |
| 18 | oven-cleaner | Oven cleaner | household-chemical | emergency | emergency | 3 | UNVERIFIED |
| 19 | simmering-potpourri | Simmering potpourri liquid | household-chemical | emergency | emergency | 3 | UNVERIFIED |
| 20 | windshield-washer-fluid | Windshield washer fluid | household-chemical | emergency | emergency | 3 | UNVERIFIED |
| 21 | adhd-stimulant-medication | ADHD stimulant medication | human-med | emergency | emergency | 3 | UNVERIFIED |
| 22 | anticoagulant-blood-thinner-medication | Prescription blood thinner medication | human-med | emergency | emergency | 3 | UNVERIFIED |
| 23 | antipsychotic-medication | Antipsychotic medication | human-med | emergency | emergency | 3 | UNVERIFIED |
| 24 | calcium-channel-blocker-medication | Calcium channel blocker medication | human-med | emergency | emergency | 3 | UNVERIFIED |
| 25 | opioid-pain-medication | Opioid pain medication | human-med | emergency | emergency | 3 | UNVERIFIED |
| 26 | vitamin-d-supplement | Vitamin D supplement | human-med | emergency | emergency | 3 | UNVERIFIED |
| 27 | anticoagulant-rodenticide | Anticoagulant rat and mouse poison | pest-bait | emergency | emergency | 3 | UNVERIFIED |
| 28 | bromethalin-rodenticide | Bromethalin rat and mouse poison | pest-bait | emergency | emergency | 3 | UNVERIFIED |
| 29 | cholecalciferol-rodenticide | Cholecalciferol (vitamin D) rat and mouse poison | pest-bait | emergency | emergency | 3 | UNVERIFIED |
| 30 | gopher-bait-strychnine | Gopher and mole bait (strychnine-type) | pest-bait | emergency | emergency | 3 | UNVERIFIED |
| 31 | metaldehyde-slug-bait | Slug and snail bait (metaldehyde) | pest-bait | emergency | emergency | 3 | UNVERIFIED |
| 32 | phosphide-rodenticide | Phosphide rat and mole poison | pest-bait | emergency | emergency | 3 | UNVERIFIED |
| 33 | essential-oils-general | Concentrated essential oils (general) | other | emergency | emergency | 3 | UNVERIFIED |
| 34 | hallucinogenic-mushrooms | Hallucinogenic mushrooms | other | emergency | emergency | 3 | UNVERIFIED |
| 35 | salt-dough | Homemade salt dough or playdough | other | emergency | emergency | 3 | UNVERIFIED |
| 36 | tea-tree-oil | Tea tree oil | other | emergency | emergency | 3 | UNVERIFIED |
| 37 | grapes | Grapes | human-food | emergency | toxic | 3 | UNVERIFIED |
| 38 | acetaminophen | Acetaminophen | human-med | toxic | emergency | 3 | UNVERIFIED |
| 39 | xylitol | Xylitol | human-food | emergency | caution | 3 | UNVERIFIED |
| 40 | true-lilies | True lilies (Lilium and Hemerocallis) | plant | caution | emergency | 3 | UNVERIFIED |
| 41 | permethrin | Permethrin | pest-bait | caution | emergency | 3 | UNVERIFIED |
| 42 | baking-powder | Baking powder | human-food | toxic | toxic | 3 | UNVERIFIED |
| 43 | baking-soda | Baking soda | human-food | toxic | toxic | 3 | UNVERIFIED |
| 44 | caffeine | Caffeine | human-food | toxic | toxic | 3 | UNVERIFIED |
| 45 | chocolate | Chocolate | human-food | toxic | toxic | 3 | UNVERIFIED |
| 46 | cooked-bones | Cooked bones | human-food | toxic | toxic | 3 | UNVERIFIED |
| 47 | corn-on-the-cob | Corn on the cob | human-food | toxic | toxic | 3 | UNVERIFIED |
| 48 | fatty-meat-trimmings | Fatty meat trimmings and skin | human-food | toxic | toxic | 3 | UNVERIFIED |
| 49 | nutmeg | Nutmeg | human-food | toxic | toxic | 3 | UNVERIFIED |
| 50 | onion | Onion and other allium plants | human-food | toxic | toxic | 3 | UNVERIFIED |
| 51 | pecans | Pecans | human-food | toxic | toxic | 3 | UNVERIFIED |
| 52 | rhubarb | Rhubarb | human-food | toxic | toxic | 3 | UNVERIFIED |
| 53 | star-fruit | Star fruit | human-food | toxic | toxic | 3 | UNVERIFIED |
| 54 | table-salt | Table salt and salty foods | human-food | toxic | toxic | 3 | UNVERIFIED |
| 55 | walnuts | Walnuts | human-food | toxic | toxic | 3 | UNVERIFIED |
| 56 | amaryllis | Amaryllis | plant | toxic | toxic | 3 | UNVERIFIED |
| 57 | azalea | Azalea | plant | toxic | toxic | 3 | UNVERIFIED |
| 58 | black-walnut-tree | Black walnut tree (hulls and mould) | plant | toxic | toxic | 3 | UNVERIFIED |
| 59 | crown-of-thorns | Crown of thorns | plant | toxic | toxic | 3 | UNVERIFIED |
| 60 | cyclamen | Cyclamen | plant | toxic | toxic | 3 | UNVERIFIED |
| 61 | daffodil | Daffodil | plant | toxic | toxic | 3 | UNVERIFIED |
| 62 | hyacinth | Hyacinth | plant | toxic | toxic | 3 | UNVERIFIED |
| 63 | iris | Iris | plant | toxic | toxic | 3 | UNVERIFIED |
| 64 | kalanchoe | Kalanchoe | plant | toxic | toxic | 3 | UNVERIFIED |
| 65 | mistletoe | Mistletoe | plant | toxic | toxic | 3 | UNVERIFIED |
| 66 | oak-acorns | Oak leaves and acorns | plant | toxic | toxic | 3 | UNVERIFIED |
| 67 | pencil-cactus | Pencil cactus | plant | toxic | toxic | 3 | UNVERIFIED |
| 68 | rhododendron | Rhododendron | plant | toxic | toxic | 3 | UNVERIFIED |
| 69 | bleach | Bleach | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 70 | fabric-softener | Fabric softener | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 71 | garden-fertilizer | Garden fertilizer | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 72 | gasoline | Gasoline | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 73 | ice-melt | Ice melt and de-icing salt | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 74 | kerosene | Kerosene | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 75 | lawn-pesticide-spray | Lawn and garden pesticide spray | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 76 | mothballs | Mothballs | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 77 | motor-oil | Motor oil | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 78 | nail-polish-remover | Nail polish remover | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 79 | paint-thinner | Paint thinner | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 80 | pool-chemicals | Pool chemicals | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 81 | rubbing-alcohol | Rubbing alcohol | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 82 | toilet-bowl-cleaner | Toilet bowl cleaner | household-chemical | toxic | toxic | 3 | UNVERIFIED |
| 83 | ace-inhibitor-medication | ACE inhibitor blood pressure medication | human-med | toxic | toxic | 3 | UNVERIFIED |
| 84 | antidepressant-medication | Antidepressant medication (SSRI/SNRI) | human-med | toxic | toxic | 3 | UNVERIFIED |
| 85 | aspirin | Aspirin | human-med | toxic | toxic | 3 | UNVERIFIED |
| 86 | benzodiazepine-medication | Benzodiazepine sedative medication | human-med | toxic | toxic | 3 | UNVERIFIED |
| 87 | beta-blocker-medication | Beta-blocker medication | human-med | toxic | toxic | 3 | UNVERIFIED |
| 88 | decongestant-medication | Decongestant medication | human-med | toxic | toxic | 3 | UNVERIFIED |
| 89 | ibuprofen | Ibuprofen | human-med | toxic | toxic | 3 | UNVERIFIED |
| 90 | iron-supplement | Iron supplement | human-med | toxic | toxic | 3 | UNVERIFIED |
| 91 | muscle-relaxant-medication | Muscle relaxant medication | human-med | toxic | toxic | 3 | UNVERIFIED |
| 92 | naproxen | Naproxen | human-med | toxic | toxic | 3 | UNVERIFIED |
| 93 | topical-nsaid-or-salicylate-cream | Topical pain cream (NSAID or methyl salicylate) | human-med | toxic | toxic | 3 | UNVERIFIED |
| 94 | boric-acid-powder | Boric acid pest powder | pest-bait | toxic | toxic | 3 | UNVERIFIED |
| 95 | deet-insect-repellent | DEET insect repellent | pest-bait | toxic | toxic | 3 | UNVERIFIED |
| 96 | flea-collar-ingestion | Chewed flea or tick collar | pest-bait | toxic | toxic | 3 | UNVERIFIED |
| 97 | lawn-insecticide-granules | Granular lawn insecticide | pest-bait | toxic | toxic | 3 | UNVERIFIED |
| 98 | alcohol-hand-sanitizer | Alcohol-based hand sanitizer | other | toxic | toxic | 3 | UNVERIFIED |
| 99 | cannabis-marijuana | Cannabis (marijuana) | other | toxic | toxic | 3 | UNVERIFIED |
| 100 | cigarette-butts | Used cigarette butts | other | toxic | toxic | 3 | UNVERIFIED |

### 4.4 Review queues for [VET] eyes

[VET] These three lists are review-priority inventories, not defects — a row appearing below is not asserted to be wrong; it is simply flagged for a human look, prioritised by likelihood of surprise.

1. Non-food-category rows verdicted `safe` at their highest severity (5): spider-plant, boston-fern, african-violet, areca-palm, christmas-cactus
2. Rows where the dog and cat verdicts differ (11): grapes, xylitol, macadamia-nuts, kiwi, peanuts, plain-yogurt, mint, true-lilies, acetaminophen, permethrin, pyrethrin-insecticide
3. Rows with no `quantityNuance` (222): avocado, macadamia-nuts, cherries, peaches, plums, apricots, citrus-fruit, banana, strawberries, blueberries, watermelon, pineapple, mango, persimmon, star-fruit, coconut, dates, figs, pomegranate, kiwi, raspberries, almonds, pecans, pistachios, peanuts, cashews, table-sugar, artificial-sweeteners, honey, maple-syrup, corn-syrup, alcohol, hops, milk, soda, fruit-juice, cheese, plain-yogurt, ice-cream, butter, cream, raw-bread-dough, baking-soda, baking-powder, moldy-food, cooked-bones, raw-bones, fatty-meat-trimmings, bacon, raw-meat, raw-fish, tomato, potato, rhubarb, asparagus, corn-on-the-cob, wild-mushrooms, button-mushrooms, broccoli, spinach, kale, brussels-sprouts, cabbage, cauliflower, peas, green-beans, carrots, cucumber, zucchini, pumpkin, sweet-potato, celery, cinnamon, table-salt, black-pepper, vanilla-extract, mint, basil, parsley, rosemary, raw-eggs, eggshells, popcorn, salty-snack-chips, pretzels, french-fries, bread-baked, pasta-cooked, rice-cooked, sago-palm, oleander, tulip, daffodil, azalea, philodendron, pothos, kalanchoe, autumn-crocus, castor-bean, lily-of-the-valley, dieffenbachia, aloe-vera, english-ivy, cyclamen, foxglove, rhododendron, hydrangea, chrysanthemum, morning-glory, hyacinth, iris, amaryllis, poinsettia, holly, mistletoe, yew, jade-plant, snake-plant, peace-lily, zz-plant, elephant-ear, caladium, begonia, geranium, chinese-evergreen, monstera, tomato-plant-leaves, oak-acorns, buttercup, hosta, deadly-nightshade, spring-crocus, black-walnut-tree, bird-of-paradise-plant, asparagus-fern, schefflera, calla-lily, rubber-plant, spider-plant, boston-fern, african-violet, areca-palm, christmas-cactus, wandering-jew, crown-of-thorns, pencil-cactus, bleach, antifreeze, paint-thinner, laundry-detergent-pods, dish-soap, fabric-softener, drain-cleaner, toilet-bowl-cleaner, oven-cleaner, rubbing-alcohol, nail-polish-remover, gasoline, kerosene, motor-oil, windshield-washer-fluid, battery-ingestion, mothballs, garden-fertilizer, lawn-pesticide-spray, pool-chemicals, super-glue, furniture-polish, plugin-air-freshener-liquid, ice-melt, simmering-potpourri, carpet-cleaner, acetaminophen, ibuprofen, naproxen, aspirin, antidepressant-medication, adhd-stimulant-medication, antihistamine-diphenhydramine, hormonal-birth-control-pills, ace-inhibitor-medication, beta-blocker-medication, calcium-channel-blocker-medication, statin-medication, vitamin-d-supplement, iron-supplement, benzodiazepine-medication, melatonin-supplement, decongestant-medication, topical-nsaid-or-salicylate-cream, laxative-medication, antacid-calcium-carbonate, thyroid-hormone-medication, opioid-pain-medication, anticoagulant-blood-thinner-medication, muscle-relaxant-medication, antipsychotic-medication, anticoagulant-rodenticide, bromethalin-rodenticide, cholecalciferol-rodenticide, phosphide-rodenticide, pyrethrin-insecticide, metaldehyde-slug-bait, ant-bait-stations, roach-bait-gel, glue-traps, deet-insect-repellent, flea-collar-ingestion, lawn-insecticide-granules, gopher-bait-strychnine, boric-acid-powder, tea-tree-oil, essential-oils-general, cannabis-marijuana, nicotine-tobacco, alcohol-hand-sanitizer, glow-sticks, salt-dough, cigarette-butts, hallucinogenic-mushrooms, kratom, cbd-oil-pet-product

## 5. Region hotline verification table

[FOUNDER] Every row below needs a founder/vet check before it can ship as human-verified (standing item `R-hotline-verify`, `packages/data/src/regions/data.ts`). No number has been dialled and no fee note has been checked in this environment.

| Region | Poison hotline | Display number | Dial number | Fee note | Source | Human verification status |
|---|---|---|---|---|---|---|
| US | ASPCA Animal Poison Control Center | (888) 426-4435 | +18884264435 | A consultation fee may apply. | ASPCA APCC — aspca.org (public listing) | UNVERIFIED |
| CA | Pet Poison Helpline | (855) 764-7661 | +18557647661 | A consultation fee may apply. | Pet Poison Helpline — petpoisonhelpline.com (serves US & Canada) | UNVERIFIED |
| GB | Animal PoisonLine | 01202 509000 | +441202509000 | A consultation fee may apply. | Animal PoisonLine — animalpoisonline.co.uk | UNVERIFIED |
| AU | Australian Animal Poisons Helpline | 1300 869 738 | 1300869738 | (none — free service) | Australian Animal Poisons Helpline — animalpoisons.com.au (free) | UNVERIFIED |
| NZ | Animal Poisons Helpline (NZ) | 0800 869 738 | 0800869738 | (none — free service) | Animal Poisons Helpline (NZ) — animalpoisons.com.au (NZ freephone, free) | UNVERIFIED |

## 6. Breed-guide reviewed-flag inventory

Of the 50 generated breed guides, 5 carry `reviewed: true` and ship in-app via `publishedBreedGuides`/`getBreedGuide`; the remaining 45 are drafts awaiting review and are never rendered.

| Species | Slug | Generated by | Reviewed by | Reviewed at |
|---|---|---|---|---|
| CAT | maine-coon | HUMAN | content-editor | 2026-07-24 |
| CAT | persian | HUMAN | content-editor | 2026-07-24 |
| DOG | german-shepherd | HUMAN | content-editor | 2026-07-24 |
| DOG | golden-retriever | HUMAN | content-editor | 2026-07-24 |
| DOG | labrador-retriever | HUMAN | content-editor | 2026-07-24 |

Unreviewed (draft) guides — listed explicitly by slug, no truncation:

| Species | Slug | Generated by |
|---|---|---|
| CAT | abyssinian | TEMPLATE |
| CAT | american-shorthair | TEMPLATE |
| CAT | bengal | TEMPLATE |
| CAT | british-shorthair | TEMPLATE |
| CAT | devon-rex | TEMPLATE |
| CAT | ragdoll | TEMPLATE |
| CAT | russian-blue | TEMPLATE |
| CAT | scottish-fold | TEMPLATE |
| CAT | siamese | TEMPLATE |
| CAT | sphynx | TEMPLATE |
| DOG | akita | TEMPLATE |
| DOG | american-cocker-spaniel | TEMPLATE |
| DOG | australian-shepherd | TEMPLATE |
| DOG | beagle | TEMPLATE |
| DOG | bernese-mountain-dog | TEMPLATE |
| DOG | border-collie | TEMPLATE |
| DOG | boston-terrier | TEMPLATE |
| DOG | boxer | TEMPLATE |
| DOG | brittany | TEMPLATE |
| DOG | cane-corso | TEMPLATE |
| DOG | cavalier-king-charles-spaniel | TEMPLATE |
| DOG | chihuahua | TEMPLATE |
| DOG | collie | TEMPLATE |
| DOG | dachshund | TEMPLATE |
| DOG | doberman-pinscher | TEMPLATE |
| DOG | english-mastiff | TEMPLATE |
| DOG | french-bulldog | TEMPLATE |
| DOG | german-shorthaired-pointer | TEMPLATE |
| DOG | great-dane | TEMPLATE |
| DOG | havanese | TEMPLATE |
| DOG | maltese | TEMPLATE |
| DOG | miniature-schnauzer | TEMPLATE |
| DOG | newfoundland | TEMPLATE |
| DOG | pembroke-welsh-corgi | TEMPLATE |
| DOG | pomeranian | TEMPLATE |
| DOG | rottweiler | TEMPLATE |
| DOG | saint-bernard | TEMPLATE |
| DOG | shiba-inu | TEMPLATE |
| DOG | shih-tzu | TEMPLATE |
| DOG | siberian-husky | TEMPLATE |
| DOG | standard-poodle | TEMPLATE |
| DOG | vizsla | TEMPLATE |
| DOG | weimaraner | TEMPLATE |
| DOG | west-highland-white-terrier | TEMPLATE |
| DOG | yorkshire-terrier | TEMPLATE |

## 7. Schema meta-tests (AC2)

AC2 ("all schema meta-tests green") is proven by running these existing specs unchanged; this audit does not replace, loosen, or skip any of them.

| Spec path | What it guards |
|---|---|
| packages/data/src/breeds/dataset.spec.ts | breed count minimums (>=300 dog, >=60 cat), slug uniqueness, the mixed-unknown row |
| packages/data/src/breeds/search.spec.ts | breed search/lookup behaviour over the breeds dataset |
| packages/data/src/toxins/dataset.spec.ts | toxin count minimums (>=220 total + per-category), id/alias-key uniqueness, the 5 pinned anchor verdicts, the section-7 dosing/diagnosis language scan |
| packages/data/src/toxins/normalize.spec.ts | the name/alias normalization + singularization used for toxin lookup |
| packages/data/src/regions/regions.spec.ts | exactly 5 hotline rows, dialNumber regex validity, non-empty source, and that the fallback carries no fabricated number |
| packages/data/src/emergency/emergency-payloads.spec.ts | emergency payload schema validity and the pinned generic fallback payload |
| packages/data/src/care-templates/care-templates.spec.ts | the fully-resolved base + vaccine-overlay care-template matrix across species/life-stage/protocol group |
| packages/data/src/breed-guides/breed-guides.spec.ts | 50 breed guides total (38 dog + 12 cat) and that publishedBreedGuides is exactly the 5 reviewed exemplars |
| packages/ai/src/content/breed-guides-safety.spec.ts | the T038 unsafe-text detector run over every string of every breed guide, published and draft alike |

### 7.1 Consumer pins outside packages/data

These web/mobile specs and modules pin the shape and values of the region hotline dataset at its point of use.

| Path | What it pins |
|---|---|
| apps/web/src/food/render.spec.tsx | every poisonHotlineName + displayNumber renders on the food-safety result page |
| apps/web/src/food/build-output.spec.ts | the hotline-info-section renders on every statically built food-safety page |
| apps/mobile/app/check/emergency/[checkId].tsx | the emergency interstitial screen resolves and renders the region hotline before any AI content |
| apps/mobile/__tests__/emergency-interstitial.test.tsx | the emergency interstitial's hotline display behaviour |
| apps/mobile/src/config/hotline-pack.ts | the bundled hotline pack shipped inside the mobile app |
| apps/mobile/__tests__/hotline-pack.test.ts | the bundled hotline pack against the live REGION_HOTLINES dataset |

## 8. Honest statement — what was NOT verified here

<!-- BEGIN:honesty -->
No hotline number was dialled or confirmed in this environment. No veterinary professional reviewed any of the spot-checked verdicts as part of producing this document. This audit used no network access or external source fetch — it is dataset-internal only, computed purely from what already exists in `packages/data`.
<!-- END:honesty -->

## 9. C3 human to-do delta

- [FOUNDER] C3 — verify all 5 poison-hotline rows (US ASPCA APCC, CA Pet Poison Helpline, GB Animal PoisonLine, AU Animal Poisons Helpline, NZ Animal Poisons Helpline): confirm each number against the operator's own published listing and confirm the fee note, then flip the column in a future task (which must also bump `BUNDLED_HOTLINE_PACK_VERSION` if any number changes). Nothing in this audit marks a row as human-checked.
- [VET] C3 — review the 100 spot-check verdicts in section 4.3 for species-appropriate correctness, prioritising the review queues in section 4.4.
- [FOUNDER/CONTENT] Post-C3 — review the unreviewed breed guides listed by slug in section 6; only `reviewed: true` guides ship today.
- [FOUNDER] Confirm that category-level (not per-row) toxin source attribution is acceptable for launch, or open a follow-up card to add a per-row `sources` field to `toxinRowSchema`.
