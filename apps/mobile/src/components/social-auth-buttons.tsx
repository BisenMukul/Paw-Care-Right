import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { useAuthStore } from "../auth/auth-store";
import { getConfig } from "../config";
import { strings } from "../strings";
import { PrimaryButton } from "./primary-button";

/**
 * Apple + Google social sign-in buttons. Both flows are wrapped in
 * try/catch; a user cancelling either flow is a no-op (not an error).
 * Native modules are jest-mocked headless (see `jest.setup.ts`) — tests
 * assert render + the mocked flow driving `store.socialSignIn`.
 */
export function SocialAuthButtons() {
  const socialSignIn = useAuthStore((state) => state.socialSignIn);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) {
          setAppleAvailable(available);
        }
      })
      .catch(() => {
        if (mounted) {
          setAppleAvailable(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const { googleClientId } = getConfig();
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = response.params.id_token ?? response.authentication?.idToken;
      if (idToken) {
        socialSignIn("google", idToken).catch(() => {
          setError(strings.auth.social.genericError);
        });
      }
    }
  }, [response, socialSignIn]);

  async function handleApplePress() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        await socialSignIn("apple", credential.identityToken);
      }
    } catch (cause) {
      const code = (cause as { code?: string } | null)?.code;
      if (code !== "ERR_REQUEST_CANCELED") {
        setError(strings.auth.social.genericError);
      }
    }
  }

  async function handleGooglePress() {
    try {
      await promptAsync();
    } catch {
      setError(strings.auth.social.genericError);
    }
  }

  return (
    <View className="gap-3">
      {appleAvailable ? (
        <PrimaryButton
          testID="social-apple-button"
          label={strings.auth.social.apple}
          onPress={handleApplePress}
        />
      ) : null}
      <PrimaryButton
        testID="social-google-button"
        label={strings.auth.social.google}
        onPress={handleGooglePress}
        disabled={!request || googleClientId === ""}
      />
      {error !== null ? (
        <Text testID="social-auth-error" className="text-center text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
