import { isApiError } from "@pawcareright/api-client";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "../../src/auth/auth-store";
import { GhostButton } from "../../src/components/ghost-button";
import { OtpInput } from "../../src/components/otp-input";
import { strings } from "../../src/strings";

export default function OtpScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const requestOtp = useAuthStore((state) => state.requestOtp);

  const [code, setCode] = useState("");
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleComplete(fullCode: string) {
    if (!email) {
      return;
    }

    setHasError(false);
    setErrorMessage(null);
    setLoading(true);

    try {
      await verifyOtp(email, fullCode);
      router.replace("/(auth)/done");
    } catch (cause) {
      setHasError(true);
      setCode("");
      if (isApiError(cause) && cause.httpStatus === 401) {
        setErrorMessage(strings.auth.otp.wrongCode);
      } else {
        setErrorMessage(strings.auth.otp.genericError);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      return;
    }
    try {
      await requestOtp(email);
    } catch {
      // Resend failures are non-blocking; the user can retry.
    }
  }

  return (
    <SafeAreaView className="flex-1 justify-center gap-6 bg-brand-50 px-6">
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.5}
        className="text-center text-base text-brand-900"
      >
        {strings.auth.otp.prompt}
      </Text>
      <OtpInput
        testID="otp-input"
        value={code}
        onChangeText={setCode}
        onComplete={handleComplete}
        hasError={hasError}
      />
      {errorMessage !== null ? (
        <Text
          testID="otp-error"
          accessibilityRole="alert"
          className="text-center text-sm text-red-700"
        >
          {errorMessage}
        </Text>
      ) : null}
      {loading ? (
        <Text testID="otp-loading" className="text-center text-sm text-brand-700">
          {strings.auth.otp.verifying}
        </Text>
      ) : null}
      <GhostButton testID="otp-resend" label={strings.auth.otp.resend} onPress={handleResend} />
    </SafeAreaView>
  );
}
