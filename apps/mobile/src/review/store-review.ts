/**
 * T109 — lazy, no-op-safe wrapper around `expo-store-review` (native
 * module). Mirrors `ota/update-controller.ts`'s `UpdatesUpdateApi` /
 * `defaultUpdatesApiLoader` idiom: a narrow LOCAL interface (NOT
 * `typeof import("expo-store-review")`) so this file typechecks whether or
 * not the package is installed (see the plan's install fallback), and the
 * native module is lazy-`require`d inside a try/catch so it never crashes
 * at module load in Expo Go / jest.
 *
 * Platform honesty (§7 of the plan): `StoreReview.requestReview()` is
 * RATE-LIMITED AND NON-GUARANTEED BY THE OS. iOS caps in-app review prompts
 * (historically ~3 per 365 days per app per device) and may show nothing at
 * all; Android's In-App Review API has its own undocumented quota and
 * resolves successfully whether or not a dialog appeared. Neither platform
 * tells us whether the dialog was actually shown. Our 1/60-days throttle
 * (`review-trigger.ts`) is therefore a FLOOR we impose on ourselves, not a
 * ceiling we can verify -- `requestStoreReview()` resolving `true` means
 * "we asked", never "the user saw a dialog". Both stores also forbid
 * incentivising or gating content on reviews -- we do neither anywhere in
 * this feature.
 */

export interface StoreReviewApi {
  isAvailableAsync?: () => Promise<boolean>;
  hasAction?: () => Promise<boolean>;
  requestReview?: () => Promise<void>;
}

export type StoreReviewLoader = () => StoreReviewApi | null;

/**
 * Lazy runtime require of `expo-store-review`, mirroring
 * `update-controller.ts`'s `defaultUpdatesApiLoader`: the native module
 * cannot load in Expo Go / the jest container (and may be entirely absent
 * if the install step was skipped -- plan §3 step 1 fallback), so it is
 * never imported at module top level. A failed `require` resolves to `null`.
 */
export const defaultStoreReviewLoader: StoreReviewLoader = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: lazy runtime require so a missing/absent native expo-store-review binding (Expo Go, jest, or a skipped install) falls back instead of crashing at module load
    const mod = require("expo-store-review");
    return (mod ?? null) as StoreReviewApi | null;
  } catch {
    return null;
  }
};

/**
 * Requests the OS review dialog. Resolves `true` only if the module loaded,
 * `isAvailableAsync()` resolved `true`, `hasAction()` (when present)
 * resolved `true`, and `requestReview()` resolved. Any absence / rejection /
 * throw anywhere in that chain resolves `false` -- never rethrown.
 */
export async function requestStoreReview(loader: StoreReviewLoader = defaultStoreReviewLoader): Promise<boolean> {
  try {
    const api = loader();

    if (api === null) {
      return false;
    }

    if (typeof api.isAvailableAsync === "function") {
      const available = await api.isAvailableAsync();
      if (!available) {
        return false;
      }
    }

    if (typeof api.hasAction === "function") {
      const hasAction = await api.hasAction();
      if (!hasAction) {
        return false;
      }
    }

    if (typeof api.requestReview !== "function") {
      return false;
    }

    await api.requestReview();
    return true;
  } catch {
    return false;
  }
}
