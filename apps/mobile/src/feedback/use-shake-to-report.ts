import { useRouter } from "expo-router";
import { useEffect } from "react";

import { subscribeToShake } from "./shake-detector";

/**
 * T104 plan step 16: subscribes to `subscribeToShake` for the lifetime of
 * the calling component (mounted once, at the app root -- see
 * `app/_layout.tsx`), routing to the feedback screen on a detected shake,
 * and cleans up the subscription on unmount. A no-op today (D1 seam) until
 * a real detector lands -- the beta-banner CTA and the Settings row are the
 * primary, always-available entry points in the meantime.
 */
export function useShakeToReport(): void {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = subscribeToShake(() => {
      router.push("/feedback");
    });
    return unsubscribe;
  }, [router]);
}
