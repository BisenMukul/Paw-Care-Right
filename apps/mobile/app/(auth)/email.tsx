import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Platform, Text, TextInput, View, findNodeHandle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthStore } from "../../src/auth/auth-store";
import { PrimaryButton } from "../../src/components/primary-button";
import { TextField } from "../../src/components/text-field";
import { strings } from "../../src/strings";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailScreen() {
  const router = useRouter();
  const requestOtp = useAuthStore((state) => state.requestOtp);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailFieldRef = useRef<TextInput>(null);

  function focusEmailField() {
    const node = findNodeHandle(emailFieldRef.current);
    if (node !== null) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }

  async function handleSubmit() {
    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(strings.auth.email.invalidEmail);
      focusEmailField();
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
      focusEmailField();
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <SafeAreaView className="flex-1 justify-center gap-6 bg-brand-50 dark:bg-surface-page-dark px-6">
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.5}
            className="text-2xl font-bold text-brand-900 dark:text-ink-dark font-display"
          >
            {strings.auth.email.title}
          </Text>
          <Text className="text-sm text-brand-700 dark:text-ink-muted-dark font-body">{strings.auth.email.subtitle}</Text>
        </View>
        <TextField
          ref={emailFieldRef}
          testID="email-input"
          errorTestID="email-error"
          label={strings.auth.email.label}
          value={email}
          onChangeText={setEmail}
          placeholder={strings.auth.email.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
        />
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
