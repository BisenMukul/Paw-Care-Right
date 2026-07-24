import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { useCallback } from "react";

const DEFAULT_FALLBACK: Href = "/(tabs)";

/**
 * FOUNDER-UX-3 plan: the shared back-navigation callback behind every
 * `AppHeader`. Deep-link entries (join links, notification taps, etc.) can
 * land on a pushed screen with no history to pop -- `router.canGoBack()`
 * gates a real `router.back()` against a caller-supplied fallback route so
 * the back control is never a dead end.
 */
export function useNavBack(fallback?: Href): () => void {
  const router = useRouter();
  const target = fallback ?? DEFAULT_FALLBACK;

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(target);
    }
  }, [router, target]);
}
