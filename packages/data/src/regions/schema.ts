import { z } from "zod";

/** ISO 3166-1 alpha-2, uppercase (T049 plan "Datasets spec"). */
export const regionCodeSchema = z.string().regex(/^[A-Z]{2}$/);

export const regionHotlineSchema = z.strictObject({
  regionCode: regionCodeSchema,
  poisonHotlineName: z.string().min(1).max(120),
  displayNumber: z.string().min(1).max(40), // human-readable, e.g. "(888) 426-4435"
  dialNumber: z.string().regex(/^[+0-9]+$/).min(3), // tel: target, e.g. "+18884264435"
  feeNote: z.string().min(1).max(200).nullable(), // null = free service
  source: z.string().min(1), // citation (also mirrored in a code comment)
});
export type RegionHotlineRow = z.infer<typeof regionHotlineSchema>;
