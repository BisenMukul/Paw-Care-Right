import { APP_DISPLAY_NAME } from "@pawcareright/config";
import * as Linking from "expo-linking";
import type { ReactNode } from "react";
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
 * Launch-time blocking "please update" screen (T079 plan). Renders ONLY
 * when the server explicitly reports a `minSupportedVersion` strictly above
 * the installed version -- fails OPEN on every uncertainty (offline/never-
 * fetched -> cached-or-default config; malformed version strings ->
 * `isUpdateRequired` returns `false`; see `version-gate.ts`). This wraps
 * the root `<Stack>` only, well outside any check/intake/red-flag/
 * emergency flow, so it can never delay emergency care (§5). No
 * disclaimer/emergency/dosing content -- a factual "please update" prompt.
 */
export function UpdateGate({ children }: UpdateGateProps) {
  const { data: config } = useAppConfig();
  const minSupportedVersion = config?.minSupportedVersion ?? DEFAULT_APP_CONFIG.minSupportedVersion;
  const updateRequired = isUpdateRequired(getAppVersion(), minSupportedVersion);

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
