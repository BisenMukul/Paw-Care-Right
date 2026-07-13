/**
 * DI tokens for the check-runner worker's provider seam (T043 plan "Files to
 * create/modify"). Mirrors the `UNSAFE_IMAGE_CHECK` symbol-token pattern in
 * `apps/api/src/vision/vision.types.ts`. No logic here.
 */
export const TRIAGE_TEXT_PROVIDER = Symbol("TRIAGE_TEXT_PROVIDER");
export const TRIAGE_TEXT_MODEL_ID = Symbol("TRIAGE_TEXT_MODEL_ID");
