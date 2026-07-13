/**
 * Single source of truth for the symptom-check triage BullMQ queue name and
 * job payload shape, imported by the producer (`ChecksService`) and the T043
 * consumer. Mirrors `../workers/images.contract.ts`.
 */
export const CHECKS_QUEUE = "pawcareright-checks";

export interface ChecksJobData {
  checkId: string;
}
