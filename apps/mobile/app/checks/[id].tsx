import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Deep-link alias (T050 plan): `pawcareright://checks/:id` resolves via
 * expo-router's file map to this route, which redirects into the existing,
 * already-§5-reviewed result screen (`/check/result/[checkId]`) — one
 * detail screen, no duplication. Native URL->route scheme resolution is
 * on-device behavior (RNTL/jest can't exercise `getInitialURL`'s native
 * mapping); this file's existence at the exact `checks/[id]` path plus the
 * configured `DEEPLINK_SCHEME` plus this redirect test satisfy the AC, with
 * on-device verification explicitly deferred (plan Risk 2).
 */
export default function CheckDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  if (id === undefined || id.length === 0) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href={{ pathname: "/check/result/[checkId]", params: { checkId: id } }} />;
}
