import { APP_DISPLAY_NAME } from "@pawcareright/config";
import * as Linking from "expo-linking";
import type { ReactNode } from "react";
import { useState } from "react";
import { Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DEFAULT_APP_CONFIG, useAppConfig } from "../config/app-config-queries";
import { getAppVersion } from "../config";
import { resolveStoreUpdateUrl } from "../config/store-update-url";
import { isUpdateRequired } from "../config/version-gate";
import { strings } from "../strings";

import { PrimaryButton } from "./primary-button";

export interface UpdateGateProps {
  children: ReactNode;
}

/**
 * Launch-time blocking "please update" screen (T079 plan; T080 carry-forward
 * makes this ENFORCED rather than emergent). Renders ONLY when the server
 * explicitly reports a `minSupportedVersion` strictly above the installed
 * version -- fails OPEN on every uncertainty (offline/never-fetched ->
 * cached-or-default config; malformed version strings -> `isUpdateRequired`
 * returns `false`; see `version-gate.ts`). This wraps the root `<Stack>`
 * only, well outside any check/intake/red-flag/emergency flow, so it can
 * never delay emergency care (§5). No disclaimer/emergency/dosing content --
 * a factual "please update" prompt.
 *
 * Cold-launch-only guarantee (T080 plan decision 1): the update decision is
 * snapshotted ONCE at first mount via a lazy `useState` initializer, not
 * read reactively from `useAppConfig()` on every render. `useAppConfig`
 * shares its `["app-config"]` cache with `usePaywallConfig` (T079 decision
 * 5); a `staleTime` on this hook's own observer would NOT stop a refetch
 * driven by that other observer (or a future online/focus-refetch bridge)
 * from updating the shared cache and re-rendering this component with a
 * fresh, possibly higher, `minSupportedVersion`. Freezing the value at
 * launch guarantees a post-mount config change can NEVER raise (or drop)
 * the gate over an already-live child tree mid-session -- a fail-open,
 * §5-protective guarantee. The fresh config is honoured normally on the
 * next cold launch (new mount -> new snapshot).
 */
export function UpdateGate({ children }: UpdateGateProps) {
  const { data: config } = useAppConfig();
  // Lazy initializer runs exactly once, on first mount, capturing the
  // launch-time cached-or-default config (`useAppConfig` seeds
  // `initialData`, so `config` is never undefined even on the first
  // render). Subsequent refetches update `config` but this snapshot is
  // never re-read.
  const [launchMinSupportedVersion] = useState(
    () => config?.minSupportedVersion ?? DEFAULT_APP_CONFIG.minSupportedVersion,
  );
  const updateRequired = isUpdateRequired(getAppVersion(), launchMinSupportedVersion);

  if (!updateRequired) {
    return <>{children}</>;
  }

  function handlePress() {
    void Linking.openURL(resolveStoreUpdateUrl(Platform.OS));
  }

  return (
    <SafeAreaView
      testID="update-gate-screen"
      className="flex-1 items-center justify-center gap-4 bg-white px-6"
    >
      <Text className="text-center text-xl font-semibold text-brand-900">
        {strings.updateGate.title(APP_DISPLAY_NAME)}
      </Text>
      <Text className="text-center text-base text-brand-700">{strings.updateGate.body}</Text>
      <PrimaryButton testID="update-gate-cta" label={strings.updateGate.cta} onPress={handlePress} />
    </SafeAreaView>
  );
}
