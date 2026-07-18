import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedGradientBackground } from "../../src/components/home/animated-gradient-background";
import { AppTitle } from "../../src/components/app-title";
import { PrimaryButton } from "../../src/components/primary-button";
import { SocialAuthButtons } from "../../src/components/social-auth-buttons";
import { useReducedMotion } from "../../src/hooks/use-reduced-motion";
import { strings } from "../../src/strings";

export default function WelcomeScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();

  return (
    <SafeAreaView className="flex-1 bg-brand-50">
      <AnimatedGradientBackground />
      <Animated.View
        testID="welcome-hero"
        className="flex-1 items-center justify-center gap-6 px-6"
        {...(reduced ? {} : { entering: FadeInDown.duration(320) })}
      >
        <Ionicons name="paw" size={48} color="#2f8f74" />
        <AppTitle variant="hero" />
        <Text className="text-center text-base text-brand-900">
          {strings.auth.welcome.tagline}
        </Text>
        <PrimaryButton
          testID="welcome-continue-email"
          label={strings.auth.welcome.continueWithEmail}
          onPress={() => router.push("/(auth)/email")}
        />
        <SocialAuthButtons />
      </Animated.View>
    </SafeAreaView>
  );
}
