import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "../../src/auth/auth-store";
import { PrimaryButton } from "../../src/components/primary-button";
import { strings } from "../../src/strings";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const router = useRouter();
  const requestOtp = useAuthStore((state) => state.requestOtp);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(strings.auth.email.invalidEmail);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Anti-enumeration: always advance on a syntactically valid email —
      // never reveal whether the address exists in the system.
      await requestOtp(trimmed);
      router.push({ pathname: "/(auth)/otp", params: { email: trimmed } });
    } catch {
      setError(strings.auth.email.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <SafeAreaView className="flex-1 justify-center gap-4 bg-white px-6">
        <Text className="text-base font-medium text-brand-900">
          {strings.auth.email.label}
        </Text>
        <TextInput
          testID="email-input"
          value={email}
          onChangeText={setEmail}
          placeholder={strings.auth.email.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
        />
        {error !== null ? (
          <Text testID="email-error" className="text-sm text-red-600">
            {error}
          </Text>
        ) : null}
        <PrimaryButton
          testID="email-submit"
          label={strings.auth.email.submit}
          onPress={handleSubmit}
          loading={loading}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
