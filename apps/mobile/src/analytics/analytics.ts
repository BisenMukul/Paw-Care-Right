import { createAnalytics, createHttpTransport, type AnalyticsEventMap, type AnalyticsEventName } from "@pawcareright/analytics";

import { useAuthStore } from "../auth/auth-store";
import { getConfig } from "../config";
import { useConsentStore } from "./consent-store";

/**
 * Module-singleton mobile emitter (T078 plan). Consent-gated via
 * `useConsentStore` (default ON, off switch in Settings) -- the ONLY
 * client-side gate; the underlying transport is separately stub-safe (an
 * empty `posthogKey` is a no-op, so Expo Go/jest never hit the network).
 */
const analytics = createAnalytics({
  transport: createHttpTransport({
    apiKey: getConfig().posthogKey,
    host: getConfig().posthogHost,
  }),
  isEnabled: () => useConsentStore.getState().enabled,
});

/**
 * Convenience wrapper: reads the signed-in user id as the PostHog
 * `distinctId`. Returns early (no-op) when there is no signed-in user --
 * never emits an anonymous/placeholder id.
 */
export function captureEvent<E extends AnalyticsEventName>(event: E, properties: AnalyticsEventMap[E]): void {
  const userId = useAuthStore.getState().user?.id;
  if (userId === undefined) {
    return;
  }
  analytics.capture(userId, event, properties);
}
