import { z } from "zod";

export function brandedId<B extends string>(brand: B) {
  void brand;
  return z.string().uuid().brand<B>();
}
export type Branded<B extends string> = z.infer<ReturnType<typeof brandedId<B>>>;

export const petIdSchema = brandedId("PetId");
export type PetId = z.infer<typeof petIdSchema>;
