/**
 * Single source of truth for the image-processing BullMQ queue name and job
 * payload shape, imported by both the producer (`PhotosService`) and the
 * consumer (`ImagesProcessor`).
 */
export const IMAGES_QUEUE = "pawcareright-images";

export interface ImagesJobData {
  petId: string;
  householdId: string;
  key: string;
}
