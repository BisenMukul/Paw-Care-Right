import { useRouter } from "expo-router";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppTitle } from "../../src/components/app-title";
import { PrimaryButton } from "../../src/components/primary-button";
import { SocialAuthButtons } from "../../src/components/social-auth-buttons";
import { strings } from "../../src/strings";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-6 bg-white px-6">
      <AppTitle />
      <Text className="text-center text-base text-brand-900">
        {strings.auth.welcome.tagline}
      </Text>
      <PrimaryButton
        testID="welcome-continue-email"
        label={strings.auth.welcome.continueWithEmail}
        onPress={() => router.push("/(auth)/email")}
      />
      <SocialAuthButtons />
    </SafeAreaView>
  );
}
