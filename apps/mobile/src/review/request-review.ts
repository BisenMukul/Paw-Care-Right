import { decideReview, type PositiveMoment, type ReviewDecision } from "./review-trigger";
import { readReviewGateState, writeLastPromptedAt } from "./review-state";
import { defaultStoreReviewLoader, requestStoreReview, type StoreReviewLoader } from "./store-review";

/**
 * T109 — thin integration: read persisted state -> pure `decideReview` ->
 * stamp -> request. Never throws (every dependency it calls is already
 * no-op-safe; this function adds no new failure surface).
 *
 * Atomicity (plan §2.5): when the decision is `"request"`,
 * `writeLastPromptedAt(now)` runs BEFORE awaiting `requestStoreReview()`, so
 * a re-entrant or duplicated call inside the same 60-day window can never
 * produce two prompts even if the native call hangs. If the native call
 * reports `false` (module absent / OS declined), the throttle stamp is kept
 * -- both stores already rate-limit and silently no-op, so un-stamping and
 * retrying would only hammer a device that will never show the dialog.
 *
 * Call sites always use `void maybeRequestReview(...)` -- never `await`,
 * never block UI.
 */
export async function maybeRequestReview(
  moment: PositiveMoment,
  deps: { now?: number; loader?: StoreReviewLoader } = {},
): Promise<ReviewDecision | "unavailable"> {
  const now = deps.now ?? Date.now();
  const loader = deps.loader ?? defaultStoreReviewLoader;

  const state = readReviewGateState();
  const decision = decideReview({ now, moment, state });

  if (decision !== "request") {
    return decision;
  }

  writeLastPromptedAt(now);
  const requested = await requestStoreReview(loader);
  return requested ? "request" : "unavailable";
}
