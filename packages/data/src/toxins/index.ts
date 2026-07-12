import { householdChemicals } from "./data/household-chemicals";
import { humanFoods } from "./data/human-foods";
import { humanMeds } from "./data/human-meds";
import { other } from "./data/other";
import { pestBaits } from "./data/pest-baits";
import { plants } from "./data/plants";
import { toxinRowSchema, type ToxinRow } from "./schema";

// Parsing at module load is the runtime validation layer; `dataset.spec.ts`
// is the build/test-time layer that additionally asserts counts/uniqueness
// (mirrors packages/data/src/breeds/index.ts).
export const toxins: readonly ToxinRow[] = Object.freeze(
  [...humanFoods, ...plants, ...householdChemicals, ...humanMeds, ...pestBaits, ...other].map((row) =>
    toxinRowSchema.parse(row),
  ),
);
