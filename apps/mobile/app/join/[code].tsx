import { isApiError } from "@pawcareright/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAcceptInvite } from "../../src/api/households-api";
import { PrimaryButton } from "../../src/components/primary-button";
import { strings } from "../../src/strings";

/**
 * Deep-link handler for `pawcareright://join/:code` (T026 plan). This route
 * only PARSES the `code` param from the URL — the scheme/deep-link string
 * itself is minted server-side (`households.service.ts`) and never
 * hardcoded here (CLAUDE.md §1a). A 404 (invalid/expired/already-used —
 * uniform, anti-probing per the API's plan Risk R1) and a 409
 * (pets-present conflict) render distinct copy; anything else falls back
 * to the same uniform invalid-link message.
 */
export default function JoinScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const acceptInvite = useAcceptInvite();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAccept() {
    if (!code) {
      return;
    }

    setErrorMessage(null);
    try {
      await acceptInvite.mutateAsync({ code });
      router.replace("/(tabs)");
    } catch (cause) {
      if (isApiError(cause) && cause.httpStatus === 409) {
        setErrorMessage(strings.join.petsPresentError);
      } else {
        setErrorMessage(strings.join.invalidError);
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-6 bg-white px-6">
      <Text testID="join-title" className="text-center text-xl font-semibold text-brand-900">
        {strings.join.title}
      </Text>
      <Text className="text-center text-base text-brand-900">{strings.join.body}</Text>
      {errorMessage !== null ? (
        <Text testID="join-error" className="text-center text-sm text-red-600">
          {errorMessage}
        </Text>
      ) : null}
      <PrimaryButton
        testID="join-accept"
        label={strings.join.accept}
        loading={acceptInvite.isPending}
        onPress={() => void handleAccept()}
      />
    </SafeAreaView>
  );
}
